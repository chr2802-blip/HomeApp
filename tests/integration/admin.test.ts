import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
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
  createUser,
  formData,
  signIn,
} from "../helpers/factories";
import { expectRedirect } from "../helpers/expect";

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

  it("refuses to invite an email that already has an account", async () => {
    const { home, admin } = await createHomeWithMembers();
    await createUser({ email: "taken@example.com" });
    await signIn(admin);

    const result = await createInvite(
      undefined,
      formData({ homeId: home.id, email: "taken@example.com", role: "USER" }),
    );

    expect(result).toEqual({ ok: false, error: "That email already has an account." });
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

    await updateHome(formData({ homeId: home.id, name: "The Nest", address: "  " }));

    expect(await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).toMatchObject({
      name: "The Nest",
      address: null,
    });
  });

  it("ignores a blank name", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await updateHome(formData({ homeId: home.id, name: "   " }));

    expect((await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).name).toBe(home.name);
  });
});

describe("updateMemberRole", () => {
  it("promotes and demotes a member", async () => {
    const { admin, member } = await createHomeWithMembers();
    await signIn(admin);

    await updateMemberRole(formData({ userId: member.id, role: "ADMIN" }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).role).toBe("ADMIN");

    await updateMemberRole(formData({ userId: member.id, role: "USER" }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).role).toBe("USER");
  });

  it("will not let an admin change their own role", async () => {
    const { admin } = await createHomeWithMembers();
    await signIn(admin);

    await updateMemberRole(formData({ userId: admin.id, role: "USER" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe("ADMIN");
  });

  it("will not touch a super admin", async () => {
    const { home, admin } = await createHomeWithMembers();
    const superAdmin = await createUser({ homeId: home.id, role: "SUPER_ADMIN" });
    await signIn(admin);

    await updateMemberRole(formData({ userId: superAdmin.id, role: "USER" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } })).role).toBe(
      "SUPER_ADMIN",
    );
  });

  it("ignores a role that is not admin or user", async () => {
    const { admin, member } = await createHomeWithMembers();
    await signIn(admin);

    await updateMemberRole(formData({ userId: member.id, role: "SUPER_ADMIN" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).role).toBe("USER");
  });
});

describe("removeMember", () => {
  it("removes a member and the content they created", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    await createList({ homeId: home.id, createdById: member.id });
    await signIn(admin);

    await removeMember(formData({ userId: member.id }));

    expect(await prisma.user.findUnique({ where: { id: member.id } })).toBeNull();
    expect(await prisma.list.count()).toBe(0);
    expect(await prisma.home.findUnique({ where: { id: home.id } })).not.toBeNull();
  });

  it("will not let an admin remove themselves or a super admin", async () => {
    const { home, admin } = await createHomeWithMembers();
    const superAdmin = await createUser({ homeId: home.id, role: "SUPER_ADMIN" });
    await signIn(admin);

    await removeMember(formData({ userId: admin.id }));
    await removeMember(formData({ userId: superAdmin.id }));

    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: superAdmin.id } })).not.toBeNull();
  });
});

describe("homes are provisioned by the super admin only", () => {
  it("creates a home", async () => {
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await createHome(formData({ name: "New House", address: "1 Main St" }));

    expect(await prisma.home.findFirstOrThrow()).toMatchObject({
      name: "New House",
      address: "1 Main St",
    });
  });

  it("ignores a blank home name", async () => {
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await createHome(formData({ name: "  " }));

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
    expect(await prisma.user.count()).toBe(1); // the super admin survives
  });

  it("turns an ordinary admin away from creating or deleting homes", async () => {
    const { home, admin } = await createHomeWithMembers();
    await signIn(admin);

    await expectRedirect(() => createHome(formData({ name: "Sneaky House" })), "/dashboard");
    await expectRedirect(() => deleteHome(formData({ homeId: home.id })), "/dashboard");

    expect(await prisma.home.count()).toBe(1);
  });
});

describe("switchHome", () => {
  it("moves the super admin's active home", async () => {
    const target = await seedHome({ name: "Target" });
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await expectRedirect(() => switchHome(formData({ homeId: target.id })), "/dashboard");

    expect((await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } })).homeId).toBe(
      target.id,
    );
  });

  it("clears the active home when given no id", async () => {
    const home = await seedHome();
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: home.id });
    await signIn(superAdmin);

    await expectRedirect(() => switchHome(formData({ homeId: "" })), "/dashboard");

    expect((await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } })).homeId).toBeNull();
  });

  it("ignores a home that does not exist", async () => {
    const home = await seedHome();
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: home.id });
    await signIn(superAdmin);

    await switchHome(formData({ homeId: "missing" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: superAdmin.id } })).homeId).toBe(
      home.id,
    );
  });
});

describe("updateOwnProfile", () => {
  it("changes the caller's name", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await updateOwnProfile(formData({ name: "New Name" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).name).toBe(
      "New Name",
    );
  });

  it("changes the password, and the new one works", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await updateOwnProfile(formData({ name: "", password: "a-brand-new-password" }));

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(await verifyPassword("a-brand-new-password", updated.passwordHash)).toBe(true);
    expect(await verifyPassword(TEST_PASSWORD, updated.passwordHash)).toBe(false);
  });

  it("refuses a password shorter than eight characters", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await updateOwnProfile(formData({ name: "Kept", password: "short" }));

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(await verifyPassword(TEST_PASSWORD, updated.passwordHash)).toBe(true);
    expect(updated.name).toBe("Test User"); // the whole update is abandoned
  });

  it("cannot be used to change anyone else's account", async () => {
    const { member, admin } = await createHomeWithMembers();
    await signIn(member);

    await updateOwnProfile(formData({ userId: admin.id, name: "Renamed" }));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).name).toBe(
      "Test User",
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).name).toBe("Renamed");
  });
});
