"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PIN_FIELD, readPins } from "@/lib/nav-tabs";

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
