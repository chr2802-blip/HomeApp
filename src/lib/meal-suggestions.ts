import { ingredientLines, shoppingText } from "./recipes";

/**
 * A recipe as the ranking needs to see it: what it is called, and what it asks the
 * household to buy.
 */
export type SuggestionCandidate = { id: string; title: string; ingredients: string };

/** One recipe offered for an empty day, and why it is being offered. */
export type MealSuggestion = {
  recipeId: string;
  title: string;
  /** How many of its ingredients the week is already buying, staples not counted. */
  shared: number;
  /** How many it asks for in total, on the same terms. */
  total: number;
};

/** How many suggestions a day is offered. Three is a choice; ten is a second recipes page. */
export const SUGGESTION_COUNT = 3;

/**
 * How much of a household's cooking an ingredient has to appear in before it stops
 * counting as something two recipes have in common.
 *
 * Salt, oil, butter and flour are in everything, so without this every recipe overlaps
 * every other and the ranking is noise wearing a number. Two fifths is high enough that
 * a genuinely popular ingredient — the onion in half the dinners — is still a staple,
 * which is right: buying one bag of onions was never the week's problem.
 */
export const STAPLE_SHARE = 0.4;

/**
 * Below this many recipes there is no such thing as a staple, only a small sample.
 *
 * In a home with three recipes, an ingredient in two of them is in 67% of the
 * household's cooking and means nothing at all. Judging anyway would throw away most of
 * what little there was to match on.
 */
export const STAPLE_MINIMUM = 8;

/**
 * What one recipe puts on a shopping list, as the keys the list itself would dedupe by.
 *
 * `shoppingText` is what makes this worth doing: it strips the leading amount, the unit
 * and the preparation note, so "200 g hakkede tomater" and "1 dåse tomater, skrællede"
 * are the one errand they are. The same normalisation `addRecipeIngredients` matches a
 * list against — two recipes overlap here exactly where their lines would have landed on
 * one row of the shopping.
 */
export function ingredientKeys(ingredients: string): Set<string> {
  const keys = new Set<string>();
  for (const line of ingredientLines(ingredients)) {
    const key = shoppingText(line).toLowerCase();
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * The ingredients so common in this home's cooking that having them in common says
 * nothing.
 *
 * Derived rather than declared: a household should not have to keep a list of its own
 * cupboard up to date for the suggestions to be worth reading, and the cupboard is
 * already described by what it cooks. Counted over every recipe the home has, not over
 * the week on screen — a fortnight of baking would otherwise make eggs remarkable again.
 */
export function staplesOf(recipes: SuggestionCandidate[]): Set<string> {
  if (recipes.length < STAPLE_MINIMUM) return new Set();

  const seen = new Map<string, number>();
  for (const recipe of recipes) {
    for (const key of ingredientKeys(recipe.ingredients)) {
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }

  const threshold = recipes.length * STAPLE_SHARE;
  return new Set([...seen].filter(([, count]) => count >= threshold).map(([key]) => key));
}

/**
 * The recipes that share most with what the week is already buying, best first.
 *
 * **Ranked by the share of a recipe's own shopping that is already in the basket, not by
 * how few new things it adds.** Fewest-new sounds like the same question and is not: it
 * is won every time by whichever recipe has the shortest ingredient list, so a
 * three-line dish with nothing in common beats a twelve-line one needing two things. The
 * ratio asks what the week is actually being asked — how much of this comes free.
 *
 * Ties break on fewer new ingredients and then on title, so the same week always offers
 * the same three. There is no randomness here to reason about: a suggestion that moved
 * when the page was refreshed would be a suggestion nobody could take a second look at.
 *
 * An empty basket returns nothing at all. With no week to share with, "best" would mean
 * "shortest", which is a ranking of recipes by how little they are — and the household
 * already has a page that lists every recipe it owns.
 */
export function rankByOverlap({
  candidates,
  basket,
  staples,
  limit = SUGGESTION_COUNT,
}: {
  /** Everything still eligible for an empty day: not planned this week, not excluded. */
  candidates: SuggestionCandidate[];
  /** Every ingredient key the week's cooking already calls for. */
  basket: Set<string>;
  staples: Set<string>;
  limit?: number;
}): MealSuggestion[] {
  const worthCounting = (keys: Set<string>) => [...keys].filter((key) => !staples.has(key));
  const inBasket = new Set(worthCounting(basket));
  if (inBasket.size === 0) return [];

  const scored: MealSuggestion[] = [];
  for (const candidate of candidates) {
    const keys = worthCounting(ingredientKeys(candidate.ingredients));
    // A recipe that is nothing but staples has no shopping of its own to share, so the
    // ratio below would be a division by zero dressed as a perfect match.
    if (keys.length === 0) continue;

    const shared = keys.filter((key) => inBasket.has(key)).length;
    if (shared === 0) continue;

    scored.push({ recipeId: candidate.id, title: candidate.title, shared, total: keys.length });
  }

  return scored
    .sort(
      (a, b) =>
        b.shared / b.total - a.shared / a.total ||
        a.total - a.shared - (b.total - b.shared) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/**
 * The sentence under a suggestion, saying what it is offering rather than a score.
 *
 * "Shares 4 of 6 ingredients" is something a cook can disagree with by looking at the
 * recipe; a number out of ten is something they can only take on trust.
 */
export function suggestionReason({ shared, total }: MealSuggestion) {
  return `Shares ${shared} of ${total} ingredients with the week`;
}
