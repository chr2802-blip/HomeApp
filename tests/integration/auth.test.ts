import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { joinWithLink, joinWithLinkAsMe, login, logout } from "@/app/actions/auth";
import {
  TEST_PASSWORD,
  createHome,
  createHomeWithMembers,
  createInviteLinkFor,
  createUser,
  formData,
  signIn,
} from "../helpers/factories";
import { captureRedirect, expectRedirect } from "../helpers/expect";
import { attemptsAllowed } from "@/lib/rate-limit";
import { hasSessionCookie, setClientIp } from "../helpers/next-mocks";

describe("login", () => {
  it("signs in with the right password and lands on the dashboard", async () => {
    const user = await createUser({ email: "cook@example.com" });

    await expectRedirect(
      () => login(undefined, formData({ email: "cook@example.com", password: TEST_PASSWORD })),
      "/dashboard",
    );

    expect((await getCurrentUser())?.id).toBe(user.id);
  });

  it("accepts the email in any casing", async () => {
    await createUser({ email: "cook@example.com" });

    await expectRedirect(
      () => login(undefined, formData({ email: "COOK@Example.com", password: TEST_PASSWORD })),
      "/dashboard",
    );
  });

  it("refuses a wrong password and creates no session", async () => {
    await createUser({ email: "cook@example.com" });

    const result = await login(undefined, formData({ email: "cook@example.com", password: "nope" }));

    expect(result).toEqual({ error: "Wrong email or password." });
    expect(hasSessionCookie()).toBe(false);
  });

  it("gives the same message for an unknown email, so accounts cannot be probed", async () => {
    const result = await login(
      undefined,
      formData({ email: "nobody@example.com", password: TEST_PASSWORD }),
    );

    expect(result).toEqual({ error: "Wrong email or password." });
  });

  it("rejects a malformed email before touching the database", async () => {
    const result = await login(undefined, formData({ email: "not-an-email", password: "x" }));

    expect(result).toEqual({ error: "Enter a valid email and password." });
    expect(await prisma.loginAttempt.count()).toBe(0);
  });

  it("logs out by clearing the session", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await expectRedirect(() => logout(), "/login");

    expect(await getCurrentUser()).toBeNull();
  });
});

describe("login throttling", () => {
  const attempt = (password: string) =>
    login(undefined, formData({ email: "cook@example.com", password }));

  it("locks out after eight failed attempts and says how long to wait", async () => {
    await createUser({ email: "cook@example.com" });

    for (let i = 0; i < 8; i++) {
      expect(await attempt("wrong")).toEqual({ error: "Wrong email or password." });
    }

    const blocked = await attempt("wrong");
    expect(blocked?.error).toMatch(/^Too many failed attempts\. Try again in \d+ minutes?\.$/);
  });

  it("still refuses the correct password while locked out", async () => {
    await createUser({ email: "cook@example.com" });
    for (let i = 0; i < 8; i++) await attempt("wrong");

    const result = await attempt(TEST_PASSWORD);

    expect(result?.error).toContain("Too many failed attempts");
    expect(hasSessionCookie()).toBe(false);
  });

  it("throttles per client, so one attacker cannot lock everyone out", async () => {
    await createUser({ email: "cook@example.com" });
    for (let i = 0; i < 8; i++) await attempt("wrong");

    setClientIp("198.51.100.7");

    await expectRedirect(() => attempt(TEST_PASSWORD), "/dashboard");
  });

  it("forgets earlier failures once a login succeeds", async () => {
    await createUser({ email: "cook@example.com" });
    for (let i = 0; i < 7; i++) await attempt("wrong");
    expect(await prisma.loginAttempt.count()).toBe(7);

    await expectRedirect(() => attempt(TEST_PASSWORD), "/dashboard");

    expect(await prisma.loginAttempt.count()).toBe(0);
  });

  it("stores no email or IP address in the attempt log", async () => {
    await createUser({ email: "cook@example.com" });
    await attempt("wrong");

    const rows = await prisma.loginAttempt.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0]!.key).not.toContain("cook");
  });
});

describe("joinWithLink", () => {
  async function roleIn(userId: string, homeId: string) {
    const membership = await prisma.homeMember.findUnique({
      where: { userId_homeId: { userId, homeId } },
    });
    return membership?.role ?? null;
  }

  async function openLink(overrides: { maxUses?: number; uses?: number; expiresAt?: Date } = {}) {
    const { home, admin, member } = await createHomeWithMembers();
    const { link, token } = await createInviteLinkFor({ homeId: home.id, createdById: admin.id, ...overrides });
    return { home, admin, member, link, token };
  }

  const newcomer = (token: string, overrides: Record<string, string> = {}) =>
    formData({ token, name: "  Newcomer  ", email: "Newcomer@Example.com", password: "a-good-password", ...overrides });

  it("creates the account, joins the home as a user, signs in and counts the use", async () => {
    const { home, link, token } = await openLink();

    expect(await captureRedirect(() => joinWithLink(undefined, newcomer(token)))).toBe("/dashboard");

    const created = await prisma.user.findUniqueOrThrow({ where: { email: "newcomer@example.com" } });
    expect(created).toMatchObject({ name: "Newcomer", activeHomeId: home.id, role: "USER" });
    expect(await roleIn(created.id, home.id)).toBe("USER");
    expect((await getCurrentUser())?.id).toBe(created.id);
    expect((await prisma.inviteLink.findUniqueOrThrow({ where: { id: link.id } })).uses).toBe(1);
  });

  it("lets as many people in as the link allows, and no more", async () => {
    const { token } = await openLink({ maxUses: 2 });

    await captureRedirect(() => joinWithLink(undefined, newcomer(token, { email: "a@example.com" })));
    await captureRedirect(() => joinWithLink(undefined, newcomer(token, { email: "b@example.com" })));
    const third = await joinWithLink(undefined, newcomer(token, { email: "c@example.com" }));

    expect(third).toEqual({ error: "This link has been used up. Ask for a new one." });
    expect(await prisma.user.findUnique({ where: { email: "c@example.com" } })).toBeNull();
  });

  it("refuses an expired link", async () => {
    const { token } = await openLink({ expiresAt: new Date(Date.now() - 1000) });

    expect(await joinWithLink(undefined, newcomer(token))).toEqual({
      error: "This link has expired. Ask for a new one.",
    });
    expect(await prisma.user.count({ where: { email: "newcomer@example.com" } })).toBe(0);
  });

  it("refuses a token nobody made, and a withdrawn one", async () => {
    const { link, token } = await openLink();
    await prisma.inviteLink.delete({ where: { id: link.id } });

    for (const attempt of ["made-up", token]) {
      expect(await joinWithLink(undefined, newcomer(attempt))).toEqual({
        error: "This link does not work. Perhaps it was withdrawn — ask for a new one.",
      });
    }
  });

  it("answers in the language of the home the link is for", async () => {
    const { home, token } = await openLink({ expiresAt: new Date(Date.now() - 1000) });
    await prisma.home.update({ where: { id: home.id }, data: { language: "DA" } });

    expect(await joinWithLink(undefined, newcomer(token))).toEqual({ error: "Linket er udløbet. Bed om et nyt." });
  });

  it("joins an existing account with its own password, with no second account made", async () => {
    const elsewhere = await createHome();
    const existing = await createUser({ email: "newcomer@example.com", homeId: elsewhere.id, role: "ADMIN" });
    const { home, token } = await openLink();

    await captureRedirect(() => joinWithLink(undefined, newcomer(token, { password: TEST_PASSWORD })));

    expect(await prisma.user.count({ where: { email: "newcomer@example.com" } })).toBe(1);
    expect(await roleIn(existing.id, home.id)).toBe("USER");
    expect(await roleIn(existing.id, elsewhere.id)).toBe("ADMIN");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).activeHomeId).toBe(home.id);
  });

  it("refuses an existing account when the password is wrong", async () => {
    const existing = await createUser({ email: "newcomer@example.com" });
    const { home, link, token } = await openLink();

    const result = await joinWithLink(undefined, newcomer(token, { password: "not-the-password" }));

    expect(result?.error).toMatch(/already has an account/);
    expect(await roleIn(existing.id, home.id)).toBeNull();
    expect((await prisma.inviteLink.findUniqueOrThrow({ where: { id: link.id } })).uses).toBe(0);
    expect(hasSessionCookie()).toBe(false);
  });

  it("uses up no place for somebody already in the home, and keeps their role", async () => {
    const { home, admin, link, token } = await openLink({ maxUses: 1 });

    await captureRedirect(() =>
      joinWithLink(undefined, newcomer(token, { email: admin.email, password: TEST_PASSWORD })),
    );

    expect(await roleIn(admin.id, home.id)).toBe("ADMIN");
    expect((await prisma.inviteLink.findUniqueOrThrow({ where: { id: link.id } })).uses).toBe(0);
  });

  it("requires a name and a password of at least eight characters", async () => {
    const { token } = await openLink();

    expect((await joinWithLink(undefined, newcomer(token, { name: " " })))?.error).toBe("Enter your name.");
    expect((await joinWithLink(undefined, newcomer(token, { password: "short" })))?.error).toBe(
      "Password must be at least 8 characters.",
    );
    expect(await prisma.user.count({ where: { email: "newcomer@example.com" } })).toBe(0);
  });

  it("throttles password guessing against an existing account", async () => {
    await createUser({ email: "newcomer@example.com" });
    const { token } = await openLink();
    setClientIp("203.0.113.9");

    for (let i = 0; i < attemptsAllowed("join"); i++) {
      await joinWithLink(undefined, newcomer(token, { password: `wrong-${i}-password` }));
    }
    const result = await joinWithLink(undefined, newcomer(token, { password: TEST_PASSWORD }));

    expect(result?.error).toMatch(/Too many failed attempts/);
  });

  it("limits how many accounts one address can make", async () => {
    const { token } = await openLink({ maxUses: 10 });
    setClientIp("203.0.113.10");

    for (let i = 0; i < attemptsAllowed("signup"); i++) {
      await captureRedirect(() => joinWithLink(undefined, newcomer(token, { email: `n${i}@example.com` })));
    }
    const result = await joinWithLink(undefined, newcomer(token, { email: "one-more@example.com" }));

    expect(result?.error).toMatch(/Many accounts have been made from here/);
    expect(await prisma.user.findUnique({ where: { email: "one-more@example.com" } })).toBeNull();
  });

  it("ignores a home named in the form: the link decides", async () => {
    const otherHome = await createHome();
    const { home, token } = await openLink();

    await captureRedirect(() => joinWithLink(undefined, newcomer(token, { homeId: otherHome.id })));

    const created = await prisma.user.findUniqueOrThrow({ where: { email: "newcomer@example.com" } });
    expect(await roleIn(created.id, home.id)).toBe("USER");
    expect(await roleIn(created.id, otherHome.id)).toBeNull();
  });
});

describe("joinWithLinkAsMe", () => {
  it("joins the signed-in person to the link's home with one press", async () => {
    const elsewhere = await createHome();
    const person = await createUser({ homeId: elsewhere.id });
    const { home, admin } = await createHomeWithMembers();
    const { link, token } = await createInviteLinkFor({ homeId: home.id, createdById: admin.id });
    await signIn(person);

    await expectRedirect(() => joinWithLinkAsMe(undefined, formData({ token })), "/dashboard");

    const membership = await prisma.homeMember.findUnique({
      where: { userId_homeId: { userId: person.id, homeId: home.id } },
    });
    expect(membership?.role).toBe("USER");
    expect((await prisma.inviteLink.findUniqueOrThrow({ where: { id: link.id } })).uses).toBe(1);
  });

  it("refuses a used-up link", async () => {
    const person = await createUser();
    const { home, admin } = await createHomeWithMembers();
    const { token } = await createInviteLinkFor({ homeId: home.id, createdById: admin.id, maxUses: 1, uses: 1 });
    await signIn(person);

    expect(await joinWithLinkAsMe(undefined, formData({ token }))).toEqual({
      error: "This link has been used up. Ask for a new one.",
    });
  });

  it("sends somebody back to a home they are already in, even on a used-up link", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    const { token } = await createInviteLinkFor({ homeId: home.id, createdById: admin.id, maxUses: 1, uses: 1 });
    await signIn(member);

    await expectRedirect(() => joinWithLinkAsMe(undefined, formData({ token })), "/dashboard");
  });

  it("sends somebody signed out to log in", async () => {
    await expectRedirect(() => joinWithLinkAsMe(undefined, formData({ token: "anything" })), "/login");
  });
});
