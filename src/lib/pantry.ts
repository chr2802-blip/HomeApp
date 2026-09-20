import { homeDb } from "./home-db";
import { shoppingText } from "./recipes";

/**
 * What a household keeps in, and what that means for a shopping list.
 *
 * Almost every recipe opens with salt, pepper, oil and butter, and almost no household
 * needs to buy any of them — so before the pantry existed, "add the lasagne" put four
 * lines on the shop that were already in the cupboard, every time, and the three that
 * mattered were somewhere in among them. The pantry is the household's answer to that,
 * kept by hand because nothing else can know it: a cupboard is not something a recipe
 * collection can be asked about.
 *
 * It is deliberately one bit per entry — see PantryItem in the schema. Running out is
 * unticking rice, not deleting it, and the next recipe that wants rice puts rice on the
 * list again.
 */

/**
 * A pantry entry as a shopping list would have written it, which is how the two are
 * matched.
 *
 * `shoppingText` is the whole of it: the same normalisation `addRecipeIngredients` uses
 * to decide that "1 dl mælk" and "5 dl mælk" are one row of the shop. Matching on
 * anything else would be a second opinion about what two lines have in common, and the
 * one that quietly disagreed would be this one — an entry that looks right on the pantry
 * page and silently fails to keep salt off the list.
 *
 * Lower-cased, because a cupboard has no opinion about capitals. The entry's own `name`
 * keeps whatever the household typed.
 */
export function pantryKey(name: string): string {
  return shoppingText(name).toLowerCase();
}

/**
 * Everything the home says it has in, as keys.
 *
 * Only the ticked entries: an entry that has been unticked is something the household
 * has run out of, and the whole point of saying so is that it goes back on the list.
 */
export async function stockedKeys(homeId: string): Promise<Set<string>> {
  const stocked = await homeDb(homeId).pantryItem.findMany({
    where: { inStock: true },
    select: { key: true },
  });
  return new Set(stocked.map((item) => item.key));
}

/**
 * The ingredients a recipe actually adds, and the ones the cupboard already answers for.
 *
 * Kept apart rather than merely filtered, because what was left out has to be said. A
 * line that quietly never arrives is indistinguishable from one the app forgot, and the
 * household that cannot tell those apart stops trusting the button — so the menu that
 * pressed it reports what the pantry covered, by name.
 *
 * Pure, and given both sides, so `tests/unit/pantry.test.ts` can hold the rule without a
 * database: the keys come from the pantry, the map is the recipe's own deduplicated
 * lines, keyed the same way.
 */
export function stripStocked(
  wanted: Map<string, string>,
  stocked: Set<string>,
): { keep: Map<string, string>; covered: string[] } {
  const keep = new Map<string, string>();
  const covered: string[] = [];

  for (const [key, text] of wanted) {
    if (stocked.has(key)) covered.push(text);
    else keep.set(key, text);
  }

  return { keep, covered };
}

/** How many things are named before the rest become a number. */
const NAMED = 3;

/**
 * A handful of names as a sentence's worth of them: "Salt, Peber and Olie", or "Salt,
 * Peber, Olie and 2 more".
 *
 * Named rather than counted, up to a point: a cook can disagree with a name — "actually
 * we're out of oil" — and can only take a number on trust. Past three it stops being a
 * sentence anybody reads to the end, so the rest becomes the number it may as well have
 * been.
 */
export function namesInWords(names: string[]): string {
  const named = names.slice(0, NAMED);
  const rest = names.length - named.length;
  const parts = rest > 0 ? [...named, `${rest} more`] : named;

  return parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * What the pantry took care of, in words, or nothing at all where it took care of
 * nothing — which is what a successful press usually has to say for itself.
 */
export function pantryNote(covered: string[]): string | undefined {
  return covered.length === 0 ? undefined : `${namesInWords(covered)} already in the pantry.`;
}

/**
 * The same sentence from the other end: what a restock run found the list already
 * saying, so a household that presses "Add to list" and sees two rows appear out of
 * five knows the other three were not lost.
 */
export function alreadyOnListNote(names: string[]): string | undefined {
  return names.length === 0 ? undefined : `${namesInWords(names)} already on the list.`;
}
