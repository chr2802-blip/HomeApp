import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { inviteCodeMatches } from "@/lib/invite-code";
import {
  createHome,
  createInvite,
  deleteHome,
  removeMember,
  revokeInvite,
  switchHome,
  updateHome,
  updateMemberRole,
  updateOwnProfile,
} from "@/app/actions/admin";
import {
  TEST_PASSWORD,
  createHome as seedHome,
  createHomeWithMembers,
  createInviteFor,
  createList,
  createPhoto,
  createUser,
  formData,
  joinHome,
  signIn,
} from "../helpers/factories";
import { expectRedirect } from "../helpers/expect";
import { cookieStore } from "../helpers/next-mocks";

describe("createInvite", () => {
  it("issues a code an admin can pass on, and stores only its hash", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    const result = await createInvite(
      undefined,
      formData({ homeId: home.id, email: "Newcomer@Example.com", role: "USER" }),
    );

    expect(result).toMatchObject({ ok: true, email: "newcomer@example.com" });
    const code = result && "code" in result ? result.code : "";
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const invite = await prisma.invite.findFirstOrThrow();
    expect(invite.codeHash).not.toContain(code.replace("-", ""));
    expect(inviteCodeMatches(code, invite.codeHash)).toBe(true);
    expect(invite).toMatchObject({ email: "newcomer@example.com", homeId: home.id, role: "USER" });
  });

  it("can invite another admin", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await createInvite(undefined, formData({ homeId: home.id, email: "a@example.com", role: "ADMIN" }));

    expect((await prisma.invite.findFirstOrThrow()).role).toBe("ADMIN");
  });

  it("expires the invite in 14 days", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await createInvite(undefined, formData({ homeId: home.id, email: "a@example.com", role: "USER" }));

    const invite = await prisma.invite.findFirstOrThrow();
    const days = (invite.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);
  });

  it("replaces an earlier unused invite for the same person, invalidating the old code", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    const first = await createInvite(
      undefined,
      formData({ homeId: home.id, email: "a@example.com", role: "USER" }),
    );
    const second = await createInvite(
      undefined,
      formData({ homeId: home.id, email: "a@example.com", role: "USER" }),
    );

    const invites = await prisma.invite.findMany();
    expect(invites).toHaveLength(1);

    const oldCode = first && "code" in first ? first.code : "";
    const newCode = second && "code" in second ? second.code : "";
    expect(inviteCodeMatches(oldCode, invites[0]!.codeHash)).toBe(false);
    expect(inviteCodeMatches(newCode, invites[0]!.codeHash)).toBe(true);
  });

  it("invites somebody who already has an account in another home", async () => {
    const { home, admin } = await createHomeWithMembers();
    const elsewhere = await seedHome();
    await createUser({ email: "neighbour@example.com", homeId: elsewhere.id });
    await signIn(admin);

    const result = await createInvite(
      undefined,
      formData({ homeId: home.id, email: "neighbour@example.com", role: "USER" }),
    );

    expect(result).toMatchObject({ ok: true, email: "neighbour@example.com" });
    expect(await prisma.invite.count()).toBe(1);
  });

  it("refuses to invite somebody who is already in this home", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    await signIn(admin);

    const result = await createInvite(
      undefined,
      formData({ homeId: home.id, email: member.email, role: "USER" }),
    );

    expect(result).toEqual({ ok: false, error: "They are already in this home." });
    expect(await prisma.invite.count()).toBe(0);
  });

  it("rejects a malformed email and an unknown role", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    expect(
      await createInvite(undefined, formData({ homeId: home.id, email: "nope", role: "USER" })),
    ).toEqual({ ok: false, error: "Enter a valid email address." });

    expect(
      await createInvite(
        undefined,
        formData({ homeId: home.id, email: "a@example.com", role: "SUPER_ADMIN" }),
      ),
    ).toEqual({ ok: false, error: "Enter a valid email address." });

    expect(await prisma.invite.count()).toBe(0);
  });
});

describe("revokeInvite", () => {
  it("deletes the invite so the code stops working", async () => {
    const { home, admin } = await createHomeWithMembers();
    const { invite } = await createInviteFor({
      email: "a@example.com",
      homeId: home.id,
      createdById: admin.id,
    });
    await signIn(admin);

    await revokeInvite(formData({ inviteId: invite.id }));

    expect(await prisma.invite.count()).toBe(0);
  });

  it("does nothing for an invite that is already gone", async () => {
    const { admin } = await createHomeWithMembers();
    await signIn(admin);

    await expect(revokeInvite(formData({ inviteId: "missing" }))).resolves.toBeUndefined();
  });
});

describe("updateHome", () => {
  it("renames the home and clears a blank address", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await updateHome(
      undefined,
      formData({ homeId: home.id, name: "The Nest", address: "  ", theme: "SLATE" }),
    );

    expect(await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).toMatchObject({
      name: "The Nest",
      address: null,
    });
  });

  it("ignores a blank name", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await updateHome(undefined, formData({ homeId: home.id, name: "   ", theme: "SLATE" }));

    expect((await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).name).toBe(home.name);
  });

  it("dresses the home in the colour that was picked", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    const result = await updateHome(
      undefined,
      formData({ homeId: home.id, name: home.name, theme: "OCEAN" }),
    );

    expect(result).toMatchObject({ ok: true });
    expect((await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).theme).toBe("OCEAN");
  });

  it("starts a new home in the app's own colours", async () => {
    const home = await seedHome();

    expect(home.theme).toBe("SLATE");
  });

  /**
   * The colour is a choice from a fixed set, and the set is what the stylesheet can
   * draw. A value from outside it would be stored happily by a text column and then
   * leave the home wearing whichever colours the page already had.
   */
  it("refuses a colour that is not one of the ones offered, keeping the one it had", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);
    await updateHome(undefined, formData({ homeId: home.id, name: home.name, theme: "PLUM" }));

    const result = await updateHome(
      undefined,
      formData({ homeId: home.id, name: "Renamed too", theme: "#ff0000" }),
    );

    expect(result).toMatchObject({ ok: false });
    // The whole submission is refused, so the name it arrived with is not saved either.
    expect(await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).toMatchObject({
      name: home.name,
      theme: "PLUM",
    });
  });

  it("leaves the colour alone when the form does not mention one", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);
    await updateHome(undefined, formData({ homeId: home.id, name: home.name, theme: "VIOLET" }));

    const result = await updateHome(undefined, formData({ homeId: home.id, name: "Renamed" }));

    expect(result).toMatchObject({ ok: true });
    expect(await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).toMatchObject({
      name: "Renamed",
      theme: "VIOLET",
    });
  });

  it("is refused for a home somebody merely lives in", async () => {
    const { home } = await createHomeWithMembers();
    const elsewhere = await seedHome();
    const outsider = await createUser({ homeId: elsewhere.id, role: "ADMIN" });
    await joinHome({ userId: outsider.id, homeId: home.id, role: "USER" });
    await signIn(outsider);

    await expect(
      updateHome(undefined, formData({ homeId: home.id, name: "Mine now", theme: "PLUM" })),
    ).rejects.toThrow("Not allowed");

    expect((await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).theme).toBe("SLATE");
  });

  /**
   * `language` follows exactly the same five cases as `theme` above: it is a choice
   * from a fixed set, a new home is not asked, and saying nothing about it leaves it
   * alone — the same "not mentioned is not changed" rule the colour already has.
   */
  it("reads the app in the language that was picked", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    const result = await updateHome(
      undefined,
      formData({ homeId: home.id, name: home.name, language: "DA" }),
    );

    expect(result).toMatchObject({ ok: true });
    expect((await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).language).toBe("DA");
  });

  it("starts a new home in the app's own voice", async () => {
    const home = await seedHome();

    expect(home.language).toBe("EN");
  });

  it("refuses a language that is not one of the ones offered, keeping the one it had", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);
    await updateHome(undefined, formData({ homeId: home.id, name: home.name, language: "DA" }));

    const result = await updateHome(
      undefined,
      formData({ homeId: home.id, name: "Renamed too", language: "FR" }),
    );

    expect(result).toMatchObject({ ok: false });
    // The whole submission is refused, so the name it arrived with is not saved either.
    expect(await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).toMatchObject({
      name: home.name,
      language: "DA",
    });
  });

  it("leaves the language alone when the form does not mention one", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);
    await updateHome(undefined, formData({ homeId: home.id, name: home.name, language: "DA" }));

    const result = await updateHome(undefined, formData({ homeId: home.id, name: "Renamed" }));

    expect(result).toMatchObject({ ok: true });
    expect(await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).toMatchObject({
      name: "Renamed",
      language: "DA",
    });
  });

  it("is refused for a home somebody merely lives in, for the language too", async () => {
    const { home } = await createHomeWithMembers();
    const elsewhere = await seedHome();
    const outsider = await createUser({ homeId: elsewhere.id, role: "ADMIN" });
    await joinHome({ userId: outsider.id, homeId: home.id, role: "USER" });
    await signIn(outsider);

    await expect(
      updateHome(undefined, formData({ homeId: home.id, name: "Mine now", language: "DA" })),
    ).rejects.toThrow("Not allowed");

    expect((await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).language).toBe("EN");
  });
});

/** What somebody may do in one named home, which is where a role lives now. */
async function roleIn(userId: string, homeId: string) {
  const membership = await prisma.homeMember.findUnique({
    where: { userId_homeId: { userId, homeId } },
  });
  return membership?.role ?? null;
}

describe("updateMemberRole", () => {
  it("promotes and demotes a member", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    await signIn(admin);

    await updateMemberRole(formData({ userId: member.id, homeId: home.id, role: "ADMIN" }));
    expect(await roleIn(member.id, home.id)).toBe("ADMIN");

    await updateMemberRole(formData({ userId: member.id, homeId: home.id, role: "USER" }));
    expect(await roleIn(member.id, home.id)).toBe("USER");
  });

  it("changes the role in the named home only", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    const second = await seedHome();
    await joinHome({ userId: member.id, homeId: second.id, role: "ADMIN" });
    await signIn(admin);

    await updateMemberRole(formData({ userId: member.id, homeId: home.id, role: "ADMIN" }));

    expect(await roleIn(member.id, home.id)).toBe("ADMIN");
    expect(await roleIn(member.id, second.id)).toBe("ADMIN");

    await updateMemberRole(formData({ userId: member.id, homeId: home.id, role: "USER" }));

    expect(await roleIn(member.id, home.id)).toBe("USER");
    // Untouched: this admin has no say in the other household.
    expect(await roleIn(member.id, second.id)).toBe("ADMIN");
  });

  it("refuses an admin of another home", async () => {
    const { home, member } = await createHomeWithMembers();
    const elsewhere = await seedHome();
    const outsider = await createUser({ homeId: elsewhere.id, role: "ADMIN" });
    await signIn(outsider);

    await expect(
      updateMemberRole(formData({ userId: member.id, homeId: home.id, role: "ADMIN" })),
    ).rejects.toThrow("Not allowed");

    expect(await roleIn(member.id, home.id)).toBe("USER");
  });

  it("will not let an admin change their own role", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await updateMemberRole(formData({ userId: admin.id, homeId: home.id, role: "USER" }));

    expect(await roleIn(admin.id, home.id)).toBe("ADMIN");
  });

  it("will not touch a super admin", async () => {
    const { home, admin } = await createHomeWithMembers();
    const superAdmin = await createUser({ homeId: home.id, role: "SUPER_ADMIN" });
    await signIn(admin);

    await updateMemberRole(formData({ userId: superAdmin.id, homeId: home.id, role: "USER" }));

    expect(await roleIn(superAdmin.id, home.id)).toBe("ADMIN");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } })).role).toBe(
      "SUPER_ADMIN",
    );
  });

  it("ignores a role that is not admin or user", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    await signIn(admin);

    await updateMemberRole(formData({ userId: member.id, homeId: home.id, role: "SUPER_ADMIN" }));

    expect(await roleIn(member.id, home.id)).toBe("USER");
  });
});

describe("removeMember", () => {
  it("takes the member out of the home, leaving their account and their work", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    await createList({ homeId: home.id, createdById: member.id });
    await signIn(admin);

    await removeMember(formData({ userId: member.id, homeId: home.id }));

    expect(await roleIn(member.id, home.id)).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: member.id } })).not.toBeNull();
    // The household keeps the list they wrote: it was the home's, not theirs.
    expect(await prisma.list.count()).toBe(1);
  });

  it("leaves the other homes they are in alone", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    const second = await seedHome();
    await joinHome({ userId: member.id, homeId: second.id });
    await signIn(admin);

    await removeMember(formData({ userId: member.id, homeId: home.id }));

    expect(await roleIn(member.id, home.id)).toBeNull();
    expect(await roleIn(member.id, second.id)).toBe("USER");
  });

  it("will not let an admin remove themselves or a super admin", async () => {
    const { home, admin } = await createHomeWithMembers();
    const superAdmin = await createUser({ homeId: home.id, role: "SUPER_ADMIN" });
    await signIn(admin);

    await removeMember(formData({ userId: admin.id, homeId: home.id }));
    await removeMember(formData({ userId: superAdmin.id, homeId: home.id }));

    expect(await roleIn(admin.id, home.id)).toBe("ADMIN");
    expect(await roleIn(superAdmin.id, home.id)).toBe("ADMIN");
  });
});

describe("homes are provisioned by the super admin only", () => {
  it("creates a home", async () => {
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await createHome(undefined, formData({ name: "New House", address: "1 Main St" }));

    expect(await prisma.home.findFirstOrThrow()).toMatchObject({
      name: "New House",
      address: "1 Main St",
    });
  });

  it("ignores a blank home name", async () => {
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await createHome(undefined, formData({ name: "  " }));

    expect(await prisma.home.count()).toBe(0);
  });

  it("deletes a home along with everything in it", async () => {
    const { home, member } = await createHomeWithMembers();
    await createList({ homeId: home.id, createdById: member.id });
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await deleteHome(formData({ homeId: home.id }));

    expect(await prisma.home.count()).toBe(0);
    expect(await prisma.list.count()).toBe(0);
    // Its people stand: what a home holds is its contents, not its members' accounts.
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.homeMember.count()).toBe(0);
  });

  it("turns an ordinary admin away from creating or deleting homes", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await expectRedirect(() => createHome(undefined, formData({ name: "Sneaky House" })), "/dashboard");
    await expectRedirect(() => deleteHome(formData({ homeId: home.id })), "/dashboard");

    expect(await prisma.home.count()).toBe(1);
  });
});

describe("switchHome", () => {
  const activeHomeOf = async (id: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id } })).activeHomeId;

  it("moves somebody between the homes they belong to", async () => {
    const { home, member } = await createHomeWithMembers();
    const second = await seedHome({ name: "Summer House" });
    await joinHome({ userId: member.id, homeId: second.id });
    await signIn(member);

    await expectRedirect(() => switchHome(formData({ homeId: second.id })), "/dashboard");
    expect(await activeHomeOf(member.id)).toBe(second.id);

    await expectRedirect(() => switchHome(formData({ homeId: home.id })), "/dashboard");
    expect(await activeHomeOf(member.id)).toBe(home.id);
  });

  it("refuses a home they are not in", async () => {
    const { home, member } = await createHomeWithMembers();
    const elsewhere = await seedHome({ name: "Not Theirs" });
    await signIn(member);

    await switchHome(formData({ homeId: elsewhere.id }));

    expect(await activeHomeOf(member.id)).toBe(home.id);
  });

  it("lets a super admin into a home they are not in", async () => {
    const target = await seedHome({ name: "Target" });
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await expectRedirect(() => switchHome(formData({ homeId: target.id })), "/dashboard");

    expect(await activeHomeOf(superAdmin.id)).toBe(target.id);
    // Reading a home is not joining it.
    expect(await prisma.homeMember.count()).toBe(0);
  });

  it("ignores a blank id and a home that does not exist", async () => {
    const home = await seedHome();
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: home.id });
    await signIn(superAdmin);

    await switchHome(formData({ homeId: "" }));
    await switchHome(formData({ homeId: "missing" }));

    expect(await activeHomeOf(superAdmin.id)).toBe(home.id);
  });
});

describe("updateOwnProfile", () => {
  it("changes the caller's name", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await updateOwnProfile(undefined, formData({ name: "New Name" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).name).toBe(
      "New Name",
    );
  });

  it("changes the password, and the new one works", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const result = await updateOwnProfile(
      undefined,
      formData({
        name: member.name,
        password: "a-brand-new-password",
        currentPassword: TEST_PASSWORD,
      }),
    );

    expect(result).toEqual({ ok: true });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(await verifyPassword("a-brand-new-password", updated.passwordHash)).toBe(true);
    expect(await verifyPassword(TEST_PASSWORD, updated.passwordHash)).toBe(false);
  });

  /*
   * A session cookie is a bearer token: whoever holds one is the account. So the two
   * things below are what stop a borrowed cookie becoming a taken account — the thief
   * does not know the password, and the owner changing it ends the sessions that were
   * already open rather than leaving the thief's working for the next thirty days.
   */
  it("refuses a new password without the current one", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const result = await updateOwnProfile(
      undefined,
      formData({ name: member.name, password: "a-brand-new-password" }),
    );

    expect(result).toEqual({ ok: false, error: "That is not your current password." });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(await verifyPassword(TEST_PASSWORD, after.passwordHash)).toBe(true);
  });

  it("refuses a wrong current password, and keeps the name typed beside it", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const result = await updateOwnProfile(
      undefined,
      formData({ name: "Renamed", password: "a-brand-new-password", currentPassword: "not-it" }),
    );

    expect(result).toEqual({ ok: false, error: "That is not your current password." });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    // Nothing was written: a wrong password must not also cost them the rename.
    expect(after.name).toBe(member.name);
    expect(await verifyPassword(TEST_PASSWORD, after.passwordHash)).toBe(true);
  });

  it("does not ask for the current password when no new one is being set", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const result = await updateOwnProfile(undefined, formData({ name: "Just A Rename" }));

    expect(result).toEqual({ ok: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).name).toBe(
      "Just A Rename",
    );
  });

  it("ends the sessions opened under the old password", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(before.tokenVersion).toBe(0);

    await updateOwnProfile(
      undefined,
      formData({
        name: member.name,
        password: "a-brand-new-password",
        currentPassword: TEST_PASSWORD,
      }),
    );

    // The version moved, so every cookie naming the old one is no longer a session.
    const after = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(after.tokenVersion).toBe(1);
    // And the person who did the changing is still signed in: the cookie was rewritten.
    expect(await getCurrentUser()).toMatchObject({ id: member.id });
  });

  it("makes a cookie held by somebody else stop working", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    // What a borrowed cookie is: the exact bytes of a session opened under the old
    // password, kept aside while the owner changes it.
    const stolen = cookieStore.get("homehub_session")!;
    expect(stolen).toBeTruthy();

    await updateOwnProfile(
      undefined,
      formData({
        name: member.name,
        password: "a-brand-new-password",
        currentPassword: TEST_PASSWORD,
      }),
    );

    // Hand the old cookie back, as the other device still would.
    cookieStore.set("homehub_session", stolen);

    // It verifies — it is properly signed and has not expired — and it is still not a
    // session, because it names a version this account has moved past.
    expect(await getCurrentUser()).toBeNull();
  });

  it("leaves the version alone when only the name changes", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await updateOwnProfile(undefined, formData({ name: "Renamed Again" }));

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).tokenVersion,
    ).toBe(0);
  });

  it("attaches a picture chosen in the home on screen", async () => {
    const { home, member } = await createHomeWithMembers();
    const picture = await createPhoto({ homeId: home.id });
    await signIn(member);

    const result = await updateOwnProfile(
      undefined,
      formData({ name: member.name, photoId: picture.id }),
    );

    expect(result).toEqual({ ok: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).photoId).toBe(
      picture.id,
    );
  });

  it("refuses a picture belonging to a home they are not in", async () => {
    const { member } = await createHomeWithMembers();
    const neighbour = await seedHome();
    const theirs = await createPhoto({ homeId: neighbour.id });
    await signIn(member);

    const result = await updateOwnProfile(
      undefined,
      formData({ name: member.name, photoId: theirs.id }),
    );

    expect(result).toMatchObject({ ok: false });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).photoId).toBeNull();
  });

  it("discards the picture it replaces, and the one taken off", async () => {
    const { home, member } = await createHomeWithMembers();
    const [first, second] = await Promise.all([
      createPhoto({ homeId: home.id }),
      createPhoto({ homeId: home.id }),
    ]);
    await signIn(member);

    await updateOwnProfile(undefined, formData({ name: member.name, photoId: first.id }));
    await updateOwnProfile(undefined, formData({ name: member.name, photoId: second.id }));

    expect(await prisma.photo.findUnique({ where: { id: first.id } })).toBeNull();

    await updateOwnProfile(undefined, formData({ name: member.name, photoId: "" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).photoId).toBeNull();
    expect(await prisma.photo.findUnique({ where: { id: second.id } })).toBeNull();
  });

  it("leaves the picture alone when the form does not carry the field", async () => {
    const { home, member } = await createHomeWithMembers();
    const picture = await createPhoto({ homeId: home.id });
    await signIn(member);

    await updateOwnProfile(undefined, formData({ name: member.name, photoId: picture.id }));
    await updateOwnProfile(undefined, formData({ name: "Renamed" }));

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(updated).toMatchObject({ name: "Renamed", photoId: picture.id });
  });

  it("refuses a blank name instead of ignoring the whole submission", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const result = await updateOwnProfile(undefined, formData({ name: "  " }));

    expect(result).toEqual({ ok: false, error: "Your name cannot be blank." });
  });

  it("keeps the name when the password is rejected", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    // The old behaviour discarded the name too, silently.
    const result = await updateOwnProfile(
      undefined,
      formData({ name: "Renamed", password: "short" }),
    );

    expect(result).toEqual({
      ok: false,
      error: "A new password must be at least 8 characters.",
    });
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(unchanged.name).toBe("Test User");
    expect(await verifyPassword(TEST_PASSWORD, unchanged.passwordHash)).toBe(true);
  });

  it("cannot be used to change anyone else's account", async () => {
    const { member, admin } = await createHomeWithMembers();
    await signIn(member);

    await updateOwnProfile(undefined, formData({ userId: admin.id, name: "Renamed" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).name).toBe(
      "Test User",
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).name).toBe("Renamed");
  });
});
