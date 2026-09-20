import { homeDb } from "./home-db";
import { leftoversLabel } from "./meals";
import { todayInZone } from "./time";

/**
 * Every recipe this home may be suggested for dinner — everything except what is filed
 * under a category an admin has excluded. A recipe under several headings is kept out
 * the moment any one of them is: a household that excludes "Baby food" does not want a
 * lasagne that also happens to be filed there.
 */
async function eligibleRecipeIds(homeId: string) {
  const recipes = await homeDb(homeId).recipe.findMany({
    where: { categories: { none: { category: { excludeFromSuggestion: true } } } },
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
 * there — this is the one write both the dashboard's silent auto-pick and its "Find new"
 * button share.
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
 * A day with nothing planned yet is where the auto-pick belongs: one eligible recipe is
 * chosen and written into `MealPlan` as today's `recipeId` before this returns, so a
 * second visit the same evening — or a glance at `/meals` — sees the same dinner rather
 * than a fresh coin flip. A day already decided is shown as it was decided: a recipe as
 * itself, leftovers as what they are the leftovers of, and a night out as nothing to
 * suggest instead of.
 *
 * Returns null when there is nothing to show at all: a night out, or nothing planned and
 * nothing eligible to plan either.
 */
export async function tonightsDinner(homeId: string): Promise<TonightsDinner> {
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
      ),
      description: null,
      photoId: source?.recipe?.photoId ?? null,
      recipeId: source?.recipe?.id ?? null,
      suggestable: false,
    };
  }

  // A row with neither column filled is a night out, already decided — there is
  // nothing to suggest instead of it.
  if (plan) return null;

  const recipeId = await pickAndStore(homeId, today);
  if (!recipeId) return null;
  const recipe = await db.recipe.findUnique({ where: { id: recipeId }, select: RECIPE_FACE });
  return recipe && fromRecipe(recipe, true);
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
