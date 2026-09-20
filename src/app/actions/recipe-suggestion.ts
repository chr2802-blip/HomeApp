"use server";

import { revalidatePath } from "next/cache";
import { requireHomeUser } from "@/lib/auth";
import { refreshTonightsDinner } from "@/lib/recipe-suggestion";

/**
 * "Find new" on the dashboard. Acts on the home already on screen rather than an id the
 * form carries — there is only ever one day to replace, today's, the same as
 * `adminHomeId` in the recipe-category actions has nothing to check against either.
 *
 * This writes into `MealPlan`, the same row `/meals` reads and writes, so that page is
 * refreshed alongside the dashboard — otherwise a household glancing at the week right
 * after pressing the button would see yesterday's pick.
 */
export async function findNewSuggestedRecipe() {
  const user = await requireHomeUser();
  await refreshTonightsDinner(user.homeId);
  revalidatePath("/dashboard");
  revalidatePath("/meals");
}
