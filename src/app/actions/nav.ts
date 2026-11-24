"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PIN_FIELD, readPins } from "@/lib/nav-tabs";
import { readTiles, TILE_FIELD } from "@/lib/dashboard-tiles";

/**
 * The two tabs this person keeps in the tab bar, in order — one `PIN_FIELD` entry each.
 * Read through `readPins`, so a tab the app does not know is dropped and a short list is
 * filled from the defaults rather than refused: the bar always has its two places.
 *
 * Nothing to report, so a plain `(formData)`: the drawer and the profile both show the
 * new arrangement optimistically and the layout catches up on revalidation.
 */
export async function setNavPins(formData: FormData): Promise<void> {
  const user = await requireUser();
  const pins = readPins(formData.getAll(PIN_FIELD));
  // `User` is a person, not a household — no home to scope by, and none needed.
  await prisma.user.update({ where: { id: user.id }, data: { navPins: pins } });
  // The bar is drawn by the app layout, on every page.
  revalidatePath("/", "layout");
}

/**
 * The dashboard's three tiles, in order — one `TILE_FIELD` entry each (empty for an
 * empty place, stored as `""`), read through
 * `readTiles` the way the pins are. Lists are kept as sent rather than checked against
 * the home open now: the choice is the person's, across homes, and the dashboard drops a
 * list it cannot find when it draws.
 */
export async function setDashboardTiles(formData: FormData): Promise<void> {
  const user = await requireUser();
  const tiles = readTiles(formData.getAll(TILE_FIELD));
  // `User` is a person, not a household — no home to scope by, and none needed.
  await prisma.user.update({ where: { id: user.id }, data: { dashboardTiles: tiles.map((tile) => tile ?? "") } });
  revalidatePath("/dashboard");
  revalidatePath("/profile");
}
