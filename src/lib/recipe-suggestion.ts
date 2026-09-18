import { homeDb } from "./home-db";
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
 * Picks a fresh suggestion and stores it as today's, replacing whatever was there.
 *
 * `exclude` is the recipe already showing, so "Find new" from the dashboard actually
 * offers something different rather than a coin flip that might land on the same meal.
 */
async function pickAndStore(homeId: string, date: string, exclude?: string) {
  const ids = await eligibleRecipeIds(homeId);
  if (ids.length === 0) return null;

  const recipeId = pickFrom(ids, exclude);
  await homeDb(homeId).recipeSuggestion.upsert({
    where: { homeId },
    // homeDb stamps the home on a create, but its types still ask for the column —
    // see createRecipeCategory for the same shape.
    create: { homeId, recipeId, date },
    update: { recipeId, date },
  });
  return recipeId;
}

/**
 * Today's suggested dinner for a home, picking and storing one if there is not already
 * a pick for today.
 *
 * "Today" is read from the home's own clock (`todayInZone`), never the server's — the
 * suggestion must not turn over at midnight UTC while it is still evening in
 * Copenhagen. A pick left over from an earlier day is replaced rather than kept, which
 * is the whole meaning of "today's" suggestion; a recipe that has since been deleted
 * never lingers here either, because deleting it takes the stored row with it.
 *
 * Returns null when the home has no recipe left to suggest — none at all, or every one
 * of them filed under an excluded category.
 */
export async function suggestedRecipeFor(homeId: string) {
  const today = todayInZone();
  const db = homeDb(homeId);

  const existing = await db.recipeSuggestion.findUnique({ where: { homeId } });
  const recipeId =
    existing?.date === today ? existing.recipeId : await pickAndStore(homeId, today);
  if (!recipeId) return null;

  return db.recipe.findUnique({ where: { id: recipeId } });
}

/** A fresh pick for today, replacing whatever was suggested before — the "Find new" button. */
export async function refreshSuggestedRecipe(homeId: string) {
  const today = todayInZone();
  const existing = await homeDb(homeId).recipeSuggestion.findUnique({ where: { homeId } });
  return pickAndStore(homeId, today, existing?.recipeId);
}
