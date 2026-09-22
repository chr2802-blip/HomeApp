"use server";

import { revalidatePath } from "next/cache";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { dueAtDaysFrom, dueAtOn, todayInZone, weekDays, weekStartOn } from "@/lib/time";
import { PLAN_FIELD, PLAN_OUT, leftoversDay } from "@/lib/meals";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sayIn } from "@/lib/copy/say";
import { MEALS } from "@/lib/copy/meals";

/**
 * The week's plan is read on the meals page, and tonight's is the sort of thing the
 * dashboard will want next; both are refreshed rather than only the page that was
 * submitted from.
 */
function refreshMealViews() {
  revalidatePath("/meals");
  revalidatePath("/dashboard");
}

/**
 * What the household is eating on one day: a recipe, a night out, yesterday's cooking
 * again, or nothing yet.
 *
 * All four arrive in one field, and each writes a different shape of row — which is the
 * point of storing it as two nullable columns that are never both filled. "Nothing
 * planned" deletes: the day has no answer, and a row saying so would be a second way of
 * saying the same thing as no row, with nothing to keep the two in step.
 *
 * The day itself is checked through `dueAtOn`, which already refuses the dates that do
 * not exist rather than rolling 31 February into March. Only its shape is checked and not
 * how far away it is: a household planning next month's Sunday roast is doing nothing
 * wrong, and the page it came from only ever offers one week at a time.
 *
 * Leftovers are the one choice that points at something else, so they are the one with
 * anything to check. The day pointed at must be **earlier** — which is what leftovers
 * means, and also what makes a cycle unwritable without keeping a second thought about
 * chains anywhere — and it must be a day this home is **cooking**, since leftovers of a
 * night out is not a sentence. Both are checked against the stored row rather than
 * against what the form believed, because the two presses are minutes apart and the
 * first one may have been undone in between.
 */
export async function planMeal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);

  const date = String(formData.get("date") ?? "").trim();
  if (!dueAtOn(date)) return fail(say(MEALS.notARealDate));

  const choice = String(formData.get(PLAN_FIELD) ?? "").trim();
  const db = homeDb(user.homeId);

  if (!choice) {
    // deleteMany rather than delete: clearing a day nobody had planned is not an error,
    // and a `delete` would raise P2025 for the second press of the same button.
    await db.mealPlan.deleteMany({ where: { date } });
    refreshMealViews();
    return ok();
  }

  const leftoverOf = leftoversDay(choice);
  if (leftoverOf !== null) {
    if (!dueAtOn(leftoverOf)) return fail(say(MEALS.notARealDate));
    if (leftoverOf >= date) return fail(say(MEALS.notYetEaten));

    // Sortable text, so the comparison above is the date comparison it looks like — the
    // same property the week's rows are fetched by name with.
    const source = await db.mealPlan.findUnique({
      where: { homeId_date: { homeId: user.homeId, date: leftoverOf } },
      select: { recipeId: true },
    });
    if (!source?.recipeId) return fail(say(MEALS.notCookedYet));
  }

  const recipeId = choice === PLAN_OUT || leftoverOf !== null ? null : choice;

  // Asked through `homeDb`, so another household's recipe is simply not found: the check
  // is the query rather than a comparison somebody has to remember to write.
  if (recipeId && !(await db.recipe.findUnique({ where: { id: recipeId } }))) {
    return fail(say(MEALS.notARecipeInHome));
  }

  await db.mealPlan.upsert({
    // homeDb stamps the home onto a create and adds it to the where, but its types still
    // ask for the column — the same shape `recordListCleared` writes a week with.
    where: { homeId_date: { homeId: user.homeId, date } },
    create: { homeId: user.homeId, date, recipeId, leftoverOf },
    // Both columns are written every time, never only the one this choice filled: a day
    // going from leftovers to a recipe has to put the pointer down on the way past, or
    // the row would be claiming both at once.
    update: { recipeId, leftoverOf },
  });

  refreshMealViews();
  return ok();
}

/**
 * Clears every day of one week in a single press, for a plan started over rather than
 * undone one day at a time.
 *
 * `week` is checked through `weekStartOn` rather than trusted as given: it comes off the
 * page's own address, and a hand-edited or stale one is still something the server is
 * being asked to act on, the same as `planMeal`'s own `date`. `deleteMany` rather than
 * seven individual clears — a week with nothing planned in it yet is cleared just as
 * successfully, the same way clearing one day nobody had planned is not an error above.
 *
 * Acts on an id (the week) and nothing it can meaningfully fail at once that id is valid,
 * so — like `toggleListItem` or `snoozeTask` — there is nothing here to report back.
 */
export async function resetMealWeek(formData: FormData) {
  const user = await requireHomeUser();

  const week = weekStartOn(String(formData.get("week") ?? ""));
  if (!week) return;

  await homeDb(user.homeId).mealPlan.deleteMany({ where: { date: { in: weekDays(week) } } });
  refreshMealViews();
}

/**
 * How far ahead "Add to meal plan" will look for a day with nothing on it yet. A
 * household that has planned every day for two months solid is not waiting on this
 * button to find a gap, and an unbounded search would turn one press into a query
 * scanning forward with no end in sight.
 */
const OPEN_DAY_HORIZON_DAYS = 60;

/**
 * Books a recipe onto the first day, starting today, that has nothing planned for it —
 * the one-press version of opening that day's sheet and picking the recipe by hand.
 *
 * It never overwrites: a day already eating out, living off leftovers, or cooking
 * something else is exactly as planned as one already holding this same recipe, so the
 * search moves past all three the same way, by the same rule `groupsFor` on the meals
 * page uses to decide which days are still worth offering a suggestion.
 *
 * Pressed from a menu that closes the instant it is chosen, so — like `snoozeTask` — it
 * quietly does its one job or quietly does nothing. The one way it can do nothing is a
 * household with every day of the next two months already spoken for, which is not a
 * mistake worth a dialog of its own.
 */
export async function addRecipeToNextOpenDay(formData: FormData) {
  const user = await requireHomeUser();
  const recipeId = String(formData.get("recipeId") ?? "").trim();
  const db = homeDb(user.homeId);

  // Asked through homeDb, so another home's recipe id is simply not found — the same
  // check planMeal makes before writing one.
  const recipe = await db.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return;

  const now = new Date();
  const start = todayInZone(now);
  const horizon = todayInZone(dueAtDaysFrom(OPEN_DAY_HORIZON_DAYS, now));

  const planned = new Set(
    (
      await db.mealPlan.findMany({
        where: { date: { gte: start, lte: horizon } },
        select: { date: true },
      })
    ).map((plan) => plan.date),
  );

  for (let offset = 0; offset <= OPEN_DAY_HORIZON_DAYS; offset++) {
    const day = todayInZone(dueAtDaysFrom(offset, now));
    if (planned.has(day)) continue;

    await db.mealPlan.create({ data: { homeId: user.homeId, date: day, recipeId } });
    refreshMealViews();
    return;
  }
}
