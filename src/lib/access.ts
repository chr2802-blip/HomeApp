import type { SessionUser } from "./auth";

/** Super admins reach any home; everyone else only their own. */
export function canAccessHome(user: SessionUser, homeId: string) {
  return user.role === "SUPER_ADMIN" || user.homeId === homeId;
}

export function assertHomeAccess(user: SessionUser, homeId: string) {
  if (!canAccessHome(user, homeId)) throw new Error("Not allowed");
}

export function canAdministerHome(user: SessionUser, homeId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  return user.role === "ADMIN" && user.homeId === homeId;
}

export function assertHomeAdmin(user: SessionUser, homeId: string) {
  if (!canAdministerHome(user, homeId)) throw new Error("Not allowed");
}
