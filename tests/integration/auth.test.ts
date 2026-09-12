import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { acceptInvite, login, logout } from "@/app/actions/auth";
import {
  TEST_PASSWORD,
  createHome,
  createHomeWithMembers,
  createInviteFor,
  createUser,
  formData,
  signIn,
} from "../helpers/factories";
import { captureRedirect, expectRedirect } from "../helpers/expect";
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

describe("acceptInvite", () => {
  async function openInvite(
    overrides: { email?: string; role?: "ADMIN" | "USER"; expiresAt?: Date } = {},
  ) {
    const { home, admin } = await createHomeWithMembers();
    const { invite, code } = await createInviteFor({
      email: overrides.email ?? "newcomer@example.com",
      homeId: home.id,
      createdById: admin.id,
      role: overrides.role,
      expiresAt: overrides.expiresAt,
    });
    return { home, admin, invite, code };
  }

  it("creates the account, joins the home and signs the person in", async () => {
    const { home, invite, code } = await openInvite();

    const destination = await captureRedirect(() =>
      acceptInvite(
        undefined,
        formData({
          email: "newcomer@example.com",
          code,
          name: "  Newcomer  ",
          password: "a-good-password",
        }),
      ),
    );

    expect(destination).toBe("/dashboard");

    const created = await prisma.user.findUnique({ where: { email: "newcomer@example.com" } });
    expect(created).toMatchObject({ name: "Newcomer", homeId: home.id, role: "USER" });
    expect((await getCurrentUser())?.id).toBe(created!.id);

    const used = await prisma.invite.findUnique({ where: { id: invite.id } });
    expect(used?.acceptedAt).toBeInstanceOf(Date);
  });

  it("grants the role the invite was created with", async () => {
    const { code } = await openInvite({ role: "ADMIN" });

    await captureRedirect(() =>
      acceptInvite(
        undefined,
        formData({
          email: "newcomer@example.com",
          code,
          name: "Newcomer",
          password: "a-good-password",
        }),
      ),
    );

    const created = await prisma.user.findUnique({ where: { email: "newcomer@example.com" } });
    expect(created?.role).toBe("ADMIN");
  });

  it("accepts the code however it is typed", async () => {
    const { code } = await openInvite();

    await expectRedirect(
      () =>
        acceptInvite(
          undefined,
          formData({
            email: "NEWCOMER@example.com",
            code: code.toLowerCase().replace("-", " "),
            name: "Newcomer",
            password: "a-good-password",
          }),
        ),
      "/dashboard",
    );
  });

  it("refuses a wrong code", async () => {
    await openInvite();

    const result = await acceptInvite(
      undefined,
      formData({
        email: "newcomer@example.com",
        code: "AAAA-BBBB",
        name: "Newcomer",
        password: "a-good-password",
      }),
    );

    expect(result).toEqual({ error: "That email and code don't match an open invitation." });
    expect(await prisma.user.findUnique({ where: { email: "newcomer@example.com" } })).toBeNull();
  });

  it("refuses a valid code presented with a different email", async () => {
    const { code } = await openInvite({ email: "invited@example.com" });

    const result = await acceptInvite(
      undefined,
      formData({
        email: "gatecrasher@example.com",
        code,
        name: "Gatecrasher",
        password: "a-good-password",
      }),
    );

    expect(result?.error).toContain("don't match an open invitation");
    expect(await prisma.user.count()).toBe(2); // only the seeded admin and member
  });

  it("refuses an expired invite", async () => {
    const { code } = await openInvite({ expiresAt: new Date(Date.now() - 1000) });

    const result = await acceptInvite(
      undefined,
      formData({
        email: "newcomer@example.com",
        code,
        name: "Newcomer",
        password: "a-good-password",
      }),
    );

    expect(result?.error).toContain("don't match an open invitation");
  });

  it("cannot be used twice", async () => {
    const { code } = await openInvite();
    const fields = {
      email: "newcomer@example.com",
      code,
      name: "Newcomer",
      password: "a-good-password",
    };

    await captureRedirect(() => acceptInvite(undefined, formData(fields)));
    const second = await acceptInvite(undefined, formData(fields));

    expect(second?.error).toContain("already exists");
    expect(await prisma.user.count()).toBe(3);
  });

  it("tells someone with an account to log in instead", async () => {
    const { code } = await openInvite();
    await createUser({ email: "newcomer@example.com" });

    const result = await acceptInvite(
      undefined,
      formData({
        email: "newcomer@example.com",
        code,
        name: "Newcomer",
        password: "a-good-password",
      }),
    );

    expect(result?.error).toContain("already exists");
  });

  it("requires a password of at least eight characters", async () => {
    const { code } = await openInvite();

    const result = await acceptInvite(
      undefined,
      formData({ email: "newcomer@example.com", code, name: "Newcomer", password: "short" }),
    );

    expect(result).toEqual({ error: "Password must be at least 8 characters." });
    expect(await prisma.user.findUnique({ where: { email: "newcomer@example.com" } })).toBeNull();
  });

  it("requires a name", async () => {
    const { code } = await openInvite();

    const result = await acceptInvite(
      undefined,
      formData({ email: "newcomer@example.com", code, name: "", password: "a-good-password" }),
    );

    expect(result).toEqual({ error: "Enter your name." });
  });

  it("throttles code guessing", async () => {
    await openInvite();
    const guess = () =>
      acceptInvite(
        undefined,
        formData({
          email: "newcomer@example.com",
          code: "ZZZZ-ZZZZ",
          name: "Guesser",
          password: "a-good-password",
        }),
      );

    for (let i = 0; i < 8; i++) await guess();

    expect((await guess())?.error).toContain("Too many failed attempts");
  });

  it("does not let an invite to one home create a user in another", async () => {
    const otherHome = await createHome();
    const { home, code } = await openInvite();

    await captureRedirect(() =>
      acceptInvite(
        undefined,
        formData({
          email: "newcomer@example.com",
          code,
          name: "Newcomer",
          password: "a-good-password",
          homeId: otherHome.id, // ignored: the invite decides
        }),
      ),
    );

    const created = await prisma.user.findUnique({ where: { email: "newcomer@example.com" } });
    expect(created?.homeId).toBe(home.id);
  });
});
