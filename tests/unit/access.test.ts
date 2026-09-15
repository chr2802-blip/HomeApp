import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import {
  assertHomeAccess,
  assertHomeAdmin,
  canAccessHome,
  canAdministerHome,
} from "@/lib/access";
import type { SessionUser } from "@/lib/auth";

const HOME = "home-a";
const OTHER = "home-b";

function user(role: Role, homeId: string | null = HOME): SessionUser {
  return {
    id: "u1",
    email: "u@example.com",
    name: "U",
    role,
    homeId,
    homeName: null,
    homePhotoId: null,
  };
}

describe("canAccessHome", () => {
  it("lets a super admin into any home", () => {
    expect(canAccessHome(user("SUPER_ADMIN", null), HOME)).toBe(true);
    expect(canAccessHome(user("SUPER_ADMIN", OTHER), HOME)).toBe(true);
  });

  it("lets admins and users into their own home", () => {
    expect(canAccessHome(user("ADMIN"), HOME)).toBe(true);
    expect(canAccessHome(user("USER"), HOME)).toBe(true);
  });

  it("keeps admins and users out of other homes", () => {
    expect(canAccessHome(user("ADMIN"), OTHER)).toBe(false);
    expect(canAccessHome(user("USER"), OTHER)).toBe(false);
  });

  it("keeps a user with no home out of every home", () => {
    expect(canAccessHome(user("USER", null), HOME)).toBe(false);
  });
});

describe("canAdministerHome", () => {
  it("lets a super admin administer any home", () => {
    expect(canAdministerHome(user("SUPER_ADMIN", null), OTHER)).toBe(true);
  });

  it("lets an admin administer only their own home", () => {
    expect(canAdministerHome(user("ADMIN"), HOME)).toBe(true);
    expect(canAdministerHome(user("ADMIN"), OTHER)).toBe(false);
  });

  it("never lets a plain user administer, even their own home", () => {
    expect(canAdministerHome(user("USER"), HOME)).toBe(false);
  });
});

describe("assertions", () => {
  it("assertHomeAccess throws only when access is refused", () => {
    expect(() => assertHomeAccess(user("USER"), HOME)).not.toThrow();
    expect(() => assertHomeAccess(user("USER"), OTHER)).toThrow("Not allowed");
  });

  it("assertHomeAdmin throws only when administration is refused", () => {
    expect(() => assertHomeAdmin(user("ADMIN"), HOME)).not.toThrow();
    expect(() => assertHomeAdmin(user("USER"), HOME)).toThrow("Not allowed");
    expect(() => assertHomeAdmin(user("ADMIN"), OTHER)).toThrow("Not allowed");
  });
});
