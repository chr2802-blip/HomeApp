"use server";

import { revalidatePath } from "next/cache";
import { requireHomeUser } from "@/lib/auth";
import { refreshSuggestedRecipe } from "@/lib/recipe-suggestion";

/**
 * "Find new" on the dashboard. Acts on the home already on screen rather than an id the
 * form carries — there is only ever one suggestion to replace, the same as
 * `adminHomeId` in the recipe-category actions has nothing to check against either.
 */
export async function findNewSuggestedRecipe() {
  const user = await requireHomeUser();
  await refreshSuggestedRecipe(user.homeId);
  revalidatePath("/dashboard");
}
