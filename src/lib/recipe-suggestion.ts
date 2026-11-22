import type { HomeLanguage } from "@prisma/client";
import { homeDb } from "./home-db";
import { leftoversLabel } from "./meals";
import { SUGGESTIBLE } from "./meal-suggestions";
import { todayInZone } from "./time";

/**
 * Every recipe this home may be suggested for dinner — everything except what is filed
 * only under categories an admin has excluded (`SUGGESTIBLE`, the meal plan's rule too).
 */
async function eligibleRecipeIds(homeId: string) {
  const recipes = await homeDb(homeId).recipe.findMany({
    where: SUGGESTIBLE,
    select: { id: true },
  });
  return recipes.map((recipe) => recipe.id);
}

/** One id at random, avoiding `exclude` when there is anything else to offer instead. */
function pickFrom(ids: string[], exclude: string | undefined) {
  const pool = exclude !== undefined && ids.length > 1 ? ids.filter((id) => id !== exclude) : ids;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Picks a fresh recipe and writes it as today's plan, replacing whatever `recipeId` was
 * there — the dashboard's "Find new" button.
 *
 * `leftoverOf` is cleared alongside it: a plan this function touches is being told what
 * to cook, and the two columns are never both filled.
 */
async function pickAndStore(homeId: string, today: string, exclude?: string) {
  const ids = await eligibleRecipeIds(homeId);
  if (ids.length === 0) return null;

  const recipeId = pickFrom(ids, exclude);
  await homeDb(homeId).mealPlan.upsert({
    where: { homeId_date: { homeId, date: today } },
    // homeDb stamps the home on a create, but its types still ask for the column —
    // see createRecipeCategory for the same shape.
    create: { homeId, date: today, recipeId, leftoverOf: null },
    update: { recipeId, leftoverOf: null },
  });
  return recipeId;
}

type RecipeFace = { id: string; title: string; description: string | null; photoId: string | null };
const RECIPE_FACE = { id: true, title: true, description: true, photoId: true } as const;

function fromRecipe(recipe: RecipeFace, suggestable: boolean): NonNullable<TonightsDinner> {
  return {
    title: recipe.title,
    description: recipe.description,
    photoId: recipe.photoId,
    recipeId: recipe.id,
    suggestable,
  };
}

/**
 * What the dashboard's "Tonight's dinner" row says, and whether "Find new" belongs
 * beside it.
 *
 * `recipeId` is null only for a leftovers day whose pointer no longer reaches anything
 * — there is a sentence to show but nothing left to link to.
 */
export type TonightsDinner = {
  title: string;
  description: string | null;
  photoId: string | null;
  recipeId: string | null;
  /** False for a decision the household already made on `/meals` — leftovers, or a
   * night out — where offering a random replacement would be arguing with it. */
  suggestable: boolean;
} | null;

/**
 * Today's dinner, read from the same `MealPlan` row `/meals` reads and writes.
 *
 * **Nothing is picked here.** A day with nothing planned shows no dinner until somebody
 * chooses one on `/meals` — an auto-pick written into the plan on the first visit was a
 * decision the household had not made, sitting on the dashboard as though it had. A day
 * already decided is shown as it was decided: a recipe as itself, leftovers as what they
 * are the leftovers of, and a night out as nothing.
 *
 * Returns null when there is nothing to show: a night out, or nothing planned.
 */
export async function tonightsDinner(homeId: string, language: HomeLanguage): Promise<TonightsDinner> {
  const today = todayInZone();
  const db = homeDb(homeId);

  const plan = await db.mealPlan.findUnique({
    where: { homeId_date: { homeId, date: today } },
    select: { leftoverOf: true, recipe: { select: RECIPE_FACE } },
  });

  if (plan?.recipe) return fromRecipe(plan.recipe, true);

  if (plan?.leftoverOf) {
    const source = await db.mealPlan.findUnique({
      where: { homeId_date: { homeId, date: plan.leftoverOf } },
      select: { recipe: { select: RECIPE_FACE } },
    });
    return {
      title: leftoversLabel(
        source?.recipe ? { day: plan.leftoverOf, title: source.recipe.title } : null,
        language,
      ),
      description: null,
      photoId: source?.recipe?.photoId ?? null,
      recipeId: source?.recipe?.id ?? null,
      suggestable: false,
    };
  }

  // A row with neither column filled is a night out, already decided; no row at all is a
  // day nobody has planned yet. Neither has a dinner to show, and nothing is picked on
  // the household's behalf: today stays empty until somebody chooses on `/meals`.
  return null;
}

/**
 * A fresh pick for today, replacing whatever recipe was planned — the dashboard's "Find
 * new" button. Only ever called while `suggestable` is true, so today already has a
 * `recipeId` to avoid repeating.
 */
export async function refreshTonightsDinner(homeId: string) {
  const today = todayInZone();
  const existing = await homeDb(homeId).mealPlan.findUnique({
    where: { homeId_date: { homeId, date: today } },
    select: { recipeId: true },
  });
  return pickAndStore(homeId, today, existing?.recipeId ?? undefined);
}
