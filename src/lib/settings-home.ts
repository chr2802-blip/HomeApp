import { cache } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { canAdministerHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";

/**
 * The home every tab of `/settings` is about, and the check that the person may run it.
 *
 * `requireAdmin` only says they run *a* home. Running one household is no licence over
 * the next, so the one on screen is checked in its own right — once, here, for the layout
 * and whichever tab it holds, rather than once per tab where one could forget.
 *
 * `home` is null for a super admin with no home open; the layout says so, and the tabs
 * draw nothing.
 */
export const settingsHome = cache(async () => {
  const user = await requireAdmin();
  if (!user.homeId) return { user, home: null };
  if (!canAdministerHome(user, user.homeId)) redirect("/dashboard");
  // Home carries no homeId of its own — it *is* the home — so `homeDb` has nothing to add.
  const home = await prisma.home.findUnique({ where: { id: user.homeId } });
  return { user, home };
});
