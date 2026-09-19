"use server";

import { revalidatePath } from "next/cache";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { dueAtOn } from "@/lib/time";
import { PLAN_FIELD, PLAN_OUT } from "@/lib/meals";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/**
 * The week's plan is read on the meals page, and tonight's is the sort of thing the
 * dashboard will want next; both are refreshed rather than only the page that was
 * submitted from.
 */
function refreshMealViews() {
  revalidatePath("/meals");
  revalidatePath("/dashboard");
}

const NOT_A_DAY = "That is not a real date.";
const NOT_A_RECIPE = "That recipe is not in this home.";

/**
 * What the household is eating on one day: a recipe, a night out, or nothing yet.
 *
 * The three arrive in one field, and each writes a different shape of row — which is the
 * point of storing it as one nullable column. "Nothing planned" deletes: the day has no
 * answer, and a row saying so would be a second way of saying the same thing as no row,
 * with nothing to keep the two in step.
 *
 * The day itself is checked through `dueAtOn`, which already refuses the dates that do
 * not exist rather than rolling 31 February into March. Only its shape is checked and not
 * how far away it is: a household planning next month's Sunday roast is doing nothing
 * wrong, and the page it came from only ever offers one week at a time.
 */
export async function planMeal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();

  const date = String(formData.get("date") ?? "").trim();
  if (!dueAtOn(date)) return fail(NOT_A_DAY);

  const choice = String(formData.get(PLAN_FIELD) ?? "").trim();
  const db = homeDb(user.homeId);

  if (!choice) {
    // deleteMany rather than delete: clearing a day nobody had planned is not an error,
    // and a `delete` would raise P2025 for the second press of the same button.
    await db.mealPlan.deleteMany({ where: { date } });
    refreshMealViews();
    return ok();
  }

  const recipeId = choice === PLAN_OUT ? null : choice;

  // Asked through `homeDb`, so another household's recipe is simply not found: the check
  // is the query rather than a comparison somebody has to remember to write.
  if (recipeId && !(await db.recipe.findUnique({ where: { id: recipeId } }))) {
    return fail(NOT_A_RECIPE);
  }

  await db.mealPlan.upsert({
    // homeDb stamps the home onto a create and adds it to the where, but its types still
    // ask for the column — the same shape `recordListCleared` writes a week with.
    where: { homeId_date: { homeId: user.homeId, date } },
    create: { homeId: user.homeId, date, recipeId },
    update: { recipeId },
  });

  refreshMealViews();
  return ok();
}
