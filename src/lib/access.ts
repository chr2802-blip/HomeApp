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
 * Whether the Administration tab is theirs: they run the home on screen. A super admin
 * keeps it with no home open, because that is where the list of every home is reached.
 */
export function canAdministerCurrentHome(user: SessionUser) {
  if (user.role === "SUPER_ADMIN") return true;
  return user.homeId !== null && canAdministerHome(user, user.homeId);
}
