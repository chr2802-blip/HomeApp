import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "./copy/say";
import { RECIPES } from "./copy/recipes";

/**
 * The field the category picker submits, one entry per heading ticked.
 *
 * A recipe belongs under as many headings as the cook says it does, so this arrives
 * repeated rather than once — which is why it is read on its own below rather than
 * through the recipe's schema.
 */
export const CATEGORY_FIELD = "categoryIds";

/**
 * The hidden field an imported recipe's form carries its signed reading in
 * (`reading-token.ts`), so a save that leaves the imported text alone need not ask the
 * reader the same question a second time.
 */
export const READING_FIELD = "reading";

/**
 * The categories a submitted form chose: in the order the picker offered them, without
 * repeats, and with nothing blank.
 *
 * Read with `getAll` rather than through `readForm`, which builds its object with
 * `Object.fromEntries` — that keeps only the last of a repeated field, so a recipe
 * filed under three headings would arrive claiming one.
 */
export function readCategoryChoice(formData: FormData) {
  const chosen = formData
    .getAll(CATEGORY_FIELD)
    .map((value) => String(value).trim())
    .filter(Boolean);

  return [...new Set(chosen)];
}

/**
 * The line the recipe list's time filter draws, and the one a household actually cares
 * about on a Tuesday: quick enough to start after work, or not. Chosen as a filter
 * rather than a sort because a cook wants "can I manage this tonight", a yes-or-no
 * question, not a list ordered by a number they still have to compare against dinner
 * time themselves.
 */
export const QUICK_RECIPE_MINUTES = 30;

/**
 * A recipe's total time in words — "25 min", "1 hr 30 min" — or null for a recipe
 * nothing has ever said a time for. Minutes alone past the hour would read as a much
 * longer number than the dish actually takes ("90 min"), which is correct and not how
 * anyone thinks about it.
 */
export function timeLabel(totalTimeMinutes: number | null, language: HomeLanguage): string | null {
  if (totalTimeMinutes === null) return null;
  const hours = Math.floor(totalTimeMinutes / 60);
  const minutes = totalTimeMinutes % 60;
  const say = sayIn(language);
  if (hours === 0) return say(RECIPES.minutesOnly, { min: minutes });
  return minutes === 0
    ? say(RECIPES.hoursOnly, { hr: hours })
    : say(RECIPES.hoursMinutes, { hr: hours, min: minutes });
}

/**
 * A recipe's ingredients as separate lines, trimmed, with the blank ones dropped.
 *
 * Ingredients are stored as one block of text — a cook writes them the way they would
 * on paper — so every reader of them has to split it the same way: the recipe page
 * drawing the list, and the action putting those lines on a shopping list. Doing it
 * here means the two cannot disagree about what counts as a line.
 */
export function ingredientLines(ingredients: string) {
  return ingredients
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * A recipe's steps as separate lines, the same way its ingredients are.
 *
 * Instructions are stored one step to a line and numbered only when they are drawn, so
 * this is the single answer to "how many steps has this recipe, and which is the third".
 * Action mode's stored breakdown carries one entry per line of this, so a second opinion
 * about where the steps divide would be a breakdown quietly describing other steps than
 * the ones on screen.
 */
export function instructionLines(instructions: string) {
  return instructions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Leading digits, a decimal, a range, or a single unicode fraction — "2", "1.5",
 *  "200-250", "½" — the shapes an ingredient line starts a measurement with. */
const FRACTION = "½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞";
const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const LEADING_AMOUNT = new RegExp(
  `^(?:${NUMBER}(?:\\s*[-–]\\s*${NUMBER})?(?:\\s*[${FRACTION}])?|[${FRACTION}])\\s+`,
);

/**
 * The handful of amount words a Danish kitchen writes ingredients with, plus their usual
 * English equivalents — not a parser for every unit in existence, only the ones a recipe
 * imported off the web or typed in by hand actually uses here.
 *
 * Exported because it is not only `shoppingText`'s business any more: the importer has to
 * know which units it may write, since a unit this set has never heard of survives
 * `shoppingText` and becomes part of the thing being bought. This is the one answer to
 * "can an amount be told apart from an ingredient here", and `recipe-normalize.ts` asks it
 * rather than keeping a list of its own to disagree with.
 */
export const UNIT_WORDS = new Set([
  "g", "gram", "gr", "kg", "kilo", "mg",
  "dl", "cl", "ml", "l", "liter",
  "tsk", "spsk", "ss", "ts",
  "stk", "styk", "stykker",
  "fed", "dåse", "dåser", "pakke", "pakker", "glas", "bundt", "skive", "skiver",
  "håndfuld", "håndfulde", "knivspids", "knsp",
  "tsp", "tbsp", "cup", "cups", "oz", "lb", "lbs", "pt", "qt",
  "clove", "cloves", "can", "cans", "slice", "slices", "bunch", "pinch",
  "tablespoon", "tablespoons", "teaspoon", "teaspoons",
]);

/**
 * An ingredient line with its amount, unit and preparation note stripped off, for
 * matching against a shopping list.
 *
 * A list item's `amount` already counts how many times something was asked for, not a
 * measurement — so "1 dl mælk" and "5 dl mælk" from two different recipes are the same
 * errand wanted twice over, not six decilitres to combine. Stripping the amount before
 * the line reaches the list is what lets them land on one row instead of two that never
 * recognise each other. The recipe page itself still shows every line whole, through
 * `ingredientLines` alone — that is what is actually measured at the stove.
 *
 * Only a leading amount is touched, and only a unit immediately after it: a line with
 * neither ("salt og friskkværnet peber") is left as written, and a word this does not
 * recognise as a unit is left in place rather than guessed at.
 *
 * What follows a comma is how the ingredient is prepared, not what to buy — "gulerødder,
 * groftrevet" is grated at the stove, not on the shelf — so it goes too, and what
 * remains is capitalised: a shopping list reads as a list of things, not as whatever
 * case the word happened to be in after a unit in front of it.
 */
export function shoppingText(line: string): string {
  const withoutAmount = line.replace(LEADING_AMOUNT, "");
  let text = withoutAmount;

  if (withoutAmount !== line) {
    const unit = withoutAmount.match(/^([\p{L}.]+)\s+/u);
    if (unit && UNIT_WORDS.has(unit[1].toLowerCase().replace(/\.$/, ""))) {
      text = withoutAmount.slice(unit[0].length);
    }
  }

  const withoutNote = text.split(",")[0].trim();
  return withoutNote.length === 0
    ? withoutNote
    : withoutNote.charAt(0).toUpperCase() + withoutNote.slice(1);
}

/** The most people a recipe is written for, or scaled to — past this it is catering. */
export const MAX_SERVINGS = 99;

/**
 * The address parameter that carries how many a recipe is being cooked for, from the
 * recipe page into action mode and back out again — so the amounts at the hob are the
 * ones that were on screen when "Start cooking" was pressed.
 */
export const PORTIONS_PARAM = "portions";

/**
 * How many a recipe is being shown for: what the address asked, where that is a whole
 * number in range, and the recipe's own `servings` otherwise. Null only for a recipe
 * nobody has said the servings of, which has nothing to scale from.
 */
export function portionsShown(servings: number | null, asked: unknown): number | null {
  if (servings === null) return null;
  const value = Number(Array.isArray(asked) ? asked[0] : asked);
  return Number.isInteger(value) && value >= 1 && value <= MAX_SERVINGS ? value : servings;
}
