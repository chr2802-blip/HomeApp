import type { SessionUser } from "./auth";

/**
 * Super admins reach any home; everyone else reaches the ones they are a member of.
 *
 * Membership rather than the home they are currently reading: somebody in three homes
 * may act on a list in any of them, and a check against the active home would refuse
 * the two they merely do not have open.
 */
export function canAccessHome(user: SessionUser, homeId: string) {
  return user.role === "SUPER_ADMIN" || user.homes.some((home) => home.id === homeId);
}

export function assertHomeAccess(user: SessionUser, homeId: string) {
  if (!canAccessHome(user, homeId)) throw new Error("Not allowed");
}

/** Running a household is per household: an admin of one is an ordinary member of the next. */
export function canAdministerHome(user: SessionUser, homeId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  return user.homes.some((home) => home.id === homeId && home.role === "ADMIN");
}

export function assertHomeAdmin(user: SessionUser, homeId: string) {
  if (!canAdministerHome(user, homeId)) throw new Error("Not allowed");
}

/**
 * Whether this home's Settings are theirs: they run the home on screen. It is asked of
 * the home being read rather than of the person, because somebody may run this
 * household and merely live in the next — the header's menu offers Settings in one and
 * not the other. A super admin runs every home, with none open included.
 */
export function canAdministerCurrentHome(user: SessionUser) {
  if (user.role === "SUPER_ADMIN") return true;
  return user.homeId !== null && canAdministerHome(user, user.homeId);
}
