import { lineInStock } from "./pantry";
import { ingredientLines, shoppingText } from "./recipes";

/**
 * "What can we cook tonight", asked of the cupboard: the recipes that use most of what
 * the household already has.
 *
 * Pure and given every side, so the sheet can re-rank as somebody types in the chicken
 * the pantry does not keep, without asking the server again, and so
 * `tests/unit/pantry-cook.test.ts` can hold the ranking without a database.
 */

/** A recipe as the ranking needs it: its lines already reduced to what is bought. */
export type CookCandidate = {
  id: string;
  title: string;
  photoId: string | null;
  /** `shoppingText` of each ingredient line, deduplicated, staples left out. */
  lines: string[];
};

export type PantryMatch = {
  recipeId: string;
  title: string;
  photoId: string | null;
  /** How many of its lines the kitchen has. */
  have: number;
  /** How many lines it has, staples not counted. */
  total: number;
  /** The lines it does not, as the recipe wrote them. */
  missing: string[];
};

/** Five is a choice between dinners; ten is the recipes page again. */
export const PANTRY_COOK_COUNT = 5;

/**
 * What one recipe asks the kitchen for, as the lines `lineInStock` reads.
 *
 * Staples are dropped rather than counted as had: "every recipe has salt" is what
 * `staplesOf` found, and a pantry that happens not to list salt should not push every
 * recipe down the ranking by one line for it.
 */
export function cookLines(ingredients: string, staples: Set<string>): string[] {
  const seen = new Map<string, string>();
  for (const line of ingredientLines(ingredients)) {
    const text = shoppingText(line);
    const key = text.toLowerCase();
    if (!key || staples.has(key) || seen.has(key)) continue;
    seen.set(key, text);
  }
  return [...seen.values()];
}

/**
 * The recipes that use the largest share of what they need from what is in, best first.
 *
 * Ranked by the share, like `rankByOverlap`, and for the same reason: fewest-missing is
 * won by the shortest recipe. Ties break on fewer missing, then the title, so the same
 * cupboard always offers the same five. A recipe the kitchen has nothing for is not
 * offered at all — it is not a suggestion, it is the recipes page in some order.
 */
export function rankByPantry({
  candidates,
  stocked,
  limit = PANTRY_COOK_COUNT,
}: {
  candidates: CookCandidate[];
  /** Pantry keys with something left, and whatever else the cook said is in. */
  stocked: Set<string>;
  limit?: number;
}): PantryMatch[] {
  if (stocked.size === 0) return [];

  const scored: PantryMatch[] = [];
  for (const candidate of candidates) {
    if (candidate.lines.length === 0) continue;
    const missing = candidate.lines.filter((line) => !lineInStock(line, stocked));
    const have = candidate.lines.length - missing.length;
    if (have === 0) continue;
    scored.push({
      recipeId: candidate.id,
      title: candidate.title,
      photoId: candidate.photoId,
      have,
      total: candidate.lines.length,
      missing,
    });
  }

  return scored
    .sort(
      (a, b) =>
        b.have / b.total - a.have / a.total ||
        a.missing.length - b.missing.length ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}
