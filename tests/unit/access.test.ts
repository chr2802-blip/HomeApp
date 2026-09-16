import { describe, expect, it } from "vitest";
import type { MemberRole } from "@prisma/client";
import {
  assertHomeAccess,
  assertHomeAdmin,
  canAccessHome,
  canAdministerCurrentHome,
  canAdministerHome,
} from "@/lib/access";
import type { SessionUser } from "@/lib/auth";

const HOME = "home-a";
const OTHER = "home-b";

/**
 * Somebody who belongs to the homes given and nothing else, reading the first of them
 * unless told otherwise. What they may reach comes from that list rather than from the
 * one they happen to be reading, which is what `reading` is here to prove.
 */
function user(
  homes: { id: string; role: MemberRole }[],
  options: { superAdmin?: boolean; reading?: string | null } = {},
): SessionUser {
  const active = options.reading === undefined ? (homes[0]?.id ?? null) : options.reading;

  return {
    id: "u1",
    email: "u@example.com",
    name: "U",
    role: options.superAdmin ? "SUPER_ADMIN" : "USER",
    homes: homes.map((home) => ({ id: home.id, name: home.id, photoId: null, role: home.role })),
    homeId: active,
    homeName: null,
    homePhotoId: null,
    photoId: null,
    homeRole: homes.find((home) => home.id === active)?.role ?? null,
  };
}

const superAdmin = (reading: string | null = null) => user([], { superAdmin: true, reading });
const adminOf = (...ids: string[]) => user(ids.map((id) => ({ id, role: "ADMIN" as const })));
const memberOf = (...ids: string[]) => user(ids.map((id) => ({ id, role: "USER" as const })));

describe("canAccessHome", () => {
  it("lets a super admin into any home", () => {
    expect(canAccessHome(superAdmin(), HOME)).toBe(true);
    expect(canAccessHome(superAdmin(OTHER), HOME)).toBe(true);
  });

  it("lets admins and users into their own home", () => {
    expect(canAccessHome(adminOf(HOME), HOME)).toBe(true);
    expect(canAccessHome(memberOf(HOME), HOME)).toBe(true);
  });

  it("keeps admins and users out of other homes", () => {
    expect(canAccessHome(adminOf(HOME), OTHER)).toBe(false);
    expect(canAccessHome(memberOf(HOME), OTHER)).toBe(false);
  });

  it("lets somebody in two homes into both of them", () => {
    const both = memberOf(HOME, OTHER);
    expect(canAccessHome(both, HOME)).toBe(true);
    expect(canAccessHome(both, OTHER)).toBe(true);
  });

  it("does not depend on which of their homes they are reading", () => {
    // The whole point of asking the memberships: a task in one home is still theirs to
    // complete while they have another open.
    expect(canAccessHome(user([{ id: HOME, role: "USER" }], { reading: null }), HOME)).toBe(true);
  });

  it("keeps a user with no home out of every home", () => {
    expect(canAccessHome(memberOf(), HOME)).toBe(false);
  });
});

describe("canAdministerHome", () => {
  it("lets a super admin administer any home", () => {
    expect(canAdministerHome(superAdmin(), OTHER)).toBe(true);
  });

  it("lets an admin administer only their own home", () => {
    expect(canAdministerHome(adminOf(HOME), HOME)).toBe(true);
    expect(canAdministerHome(adminOf(HOME), OTHER)).toBe(false);
  });

  it("is per home, not per person", () => {
    // Running one household says nothing about the next one they live in.
    const both = user([
      { id: HOME, role: "ADMIN" },
      { id: OTHER, role: "USER" },
    ]);
    expect(canAdministerHome(both, HOME)).toBe(true);
    expect(canAdministerHome(both, OTHER)).toBe(false);
  });

  it("never lets a plain user administer, even their own home", () => {
    expect(canAdministerHome(memberOf(HOME), HOME)).toBe(false);
  });
});

describe("canAdministerCurrentHome", () => {
  it("is true where they run the home on screen", () => {
    expect(canAdministerCurrentHome(adminOf(HOME))).toBe(true);
  });

  it("is false where they merely live in the home on screen", () => {
    const both = user([
      { id: HOME, role: "ADMIN" },
      { id: OTHER, role: "USER" },
    ]);
    expect(canAdministerCurrentHome({ ...both, homeId: OTHER, homeRole: "USER" })).toBe(false);
  });

  it("stays true for a super admin with no home open", () => {
    expect(canAdministerCurrentHome(superAdmin())).toBe(true);
  });
});

describe("assertions", () => {
  it("assertHomeAccess throws only when access is refused", () => {
    expect(() => assertHomeAccess(memberOf(HOME), HOME)).not.toThrow();
    expect(() => assertHomeAccess(memberOf(HOME), OTHER)).toThrow("Not allowed");
  });

  it("assertHomeAdmin throws only when administration is refused", () => {
    expect(() => assertHomeAdmin(adminOf(HOME), HOME)).not.toThrow();
    expect(() => assertHomeAdmin(memberOf(HOME), HOME)).toThrow("Not allowed");
    expect(() => assertHomeAdmin(adminOf(HOME), OTHER)).toThrow("Not allowed");
  });
});
