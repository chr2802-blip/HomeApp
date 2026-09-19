import { afterEach, describe, expect, it, vi } from "vitest";
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
  createPhoto,
  createUser,
  formData,
  joinHome,
  signIn,
} from "../helpers/factories";
import { expectRedirect } from "../helpers/expect";
import { headerStore } from "../helpers/next-mocks";

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

  describe("sending it", () => {
    /**
     * Mail is off by default in this suite, exactly as it is on an installation nobody
     * has configured — see the note beside the VAPID keys in vitest.config.mts. A test
     * that wants a send turns it on for itself and stubs the network, so nothing here
     * can leave the machine.
     */
    function configureMail(response: Response | Error = new Response(null, { status: 200 })) {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("EMAIL_FROM", "HomeHub <hub@example.com>");
      headerStore.set("host", "home.example");

      const fetchMock = vi.fn(async () => {
        if (response instanceof Error) throw response;
        return response;
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    function sentBody(fetchMock: ReturnType<typeof configureMail>) {
      const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
      return JSON.parse(init.body as string) as { to: string[]; subject: string; text: string };
    }

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("emails the invited address a link carrying the code", async () => {
      const fetchMock = configureMail();
      const { home, admin } = await createHomeWithMembers();
      await signIn(admin);

      const result = await createInvite(
        undefined,
        formData({ homeId: home.id, email: "Newcomer@Example.com", role: "USER" }),
      );

      expect(result).toMatchObject({ ok: true, sent: true });
      const code = result && "code" in result ? result.code : "";

      const body = sentBody(fetchMock);
      // The lowercased address, which is the one the invitation is filed under and
      // therefore the only one it can be accepted with.
      expect(body.to).toEqual(["newcomer@example.com"]);
      expect(body.subject).toContain(home.name);

      const link = new URL(result && "link" in result ? (result.link ?? "") : "");
      expect(link.origin).toBe("https://home.example");
      expect(link.pathname).toBe("/accept-invite");
      expect(link.searchParams.get("email")).toBe("newcomer@example.com");
      expect(link.searchParams.get("code")).toBe(code);
      expect(body.text).toContain(link.toString());
    });

    it("sends the code that was actually stored, so the emailed link works", async () => {
      const fetchMock = configureMail();
      const { home, admin } = await createHomeWithMembers();
      await signIn(admin);

      await createInvite(
        undefined,
        formData({ homeId: home.id, email: "a@example.com", role: "USER" }),
      );

      const emailed = new URL(
        sentBody(fetchMock).text.match(/https:\/\/\S+/)![0],
      ).searchParams.get("code")!;
      const invite = await prisma.invite.findFirstOrThrow();
      expect(inviteCodeMatches(emailed, invite.codeHash)).toBe(true);
    });

    it("keeps the invitation when the mail server refuses it, and says why", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      configureMail(new Response("no such sending domain", { status: 403 }));
      const { home, admin } = await createHomeWithMembers();
      await signIn(admin);

      const result = await createInvite(
        undefined,
        formData({ homeId: home.id, email: "a@example.com", role: "USER" }),
      );

      // The delivery failed; the invitation did not. An admin with the code on screen
      // can still pass it on, which is the whole arrangement.
      expect(result).toMatchObject({
        ok: true,
        sent: false,
        reason: "The mail server rejected this installation's key.",
      });
      expect(result && "link" in result && result.link).toContain("/accept-invite?");
      expect(await prisma.invite.count()).toBe(1);
    });

    it("issues the invitation without sending anything where mail is not configured", async () => {
      headerStore.set("host", "home.example");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const { home, admin } = await createHomeWithMembers();
      await signIn(admin);

      const result = await createInvite(
        undefined,
        formData({ homeId: home.id, email: "a@example.com", role: "USER" }),
      );

      expect(result).toMatchObject({
        ok: true,
        sent: false,
        reason: "Email is not configured on this installation.",
      });
      // The link is still built and still shown: it is the thing an admin passes on
      // by hand, and it is useful precisely when nothing was sent.
      expect(result && "link" in result && result.link).toContain("/accept-invite?");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await prisma.invite.count()).toBe(1);
    });

    it("sends nothing when it cannot work out its own address to link to", async () => {
      const fetchMock = configureMail();
      // No host header and no APP_URL: there is no address to put in a link, and a
      // message with no link is a message saying less than the screen already does.
      headerStore.delete("host");
      const { home, admin } = await createHomeWithMembers();
      await signIn(admin);

      const result = await createInvite(
        undefined,
        formData({ homeId: home.id, email: "a@example.com", role: "USER" }),
      );

      expect(result).toMatchObject({ ok: true, sent: false, link: null });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await prisma.invite.count()).toBe(1);
    });
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
      formData({ name: member.name, password: "a-brand-new-password" }),
    );

    expect(result).toEqual({ ok: true });
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(await verifyPassword("a-brand-new-password", updated.passwordHash)).toBe(true);
    expect(await verifyPassword(TEST_PASSWORD, updated.passwordHash)).toBe(false);
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
