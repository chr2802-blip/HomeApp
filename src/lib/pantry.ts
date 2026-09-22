import type { HomeLanguage } from "@prisma/client";
import { shoppingText } from "./recipes";
import { sayIn } from "./copy/say";
import { PANTRY } from "./copy/pantry";

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
 * The handful of ways a line names more than one thing — "salt og peber", "salt and
 * pepper", "salt & peber" — split apart only far enough to check each half against the
 * pantry separately. Nothing else reads a line this way: `ingredientLines` and the
 * recipe page still show it exactly as written, and the shopping list still carries it
 * as the one line it was typed as.
 */
const CONJUNCTION = /\s+(?:og|and)\s+|\s*&\s*/i;

/** A line split on its conjunction, and which of its parts the pantry already has. */
function matchParts(
  text: string,
  stocked: Set<string>,
): { parts: string[]; matched: string[] } | null {
  const parts = text
    .split(CONJUNCTION)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  return { parts, matched: parts.filter((part) => stocked.has(pantryKey(part))) };
}

/**
 * A recipe line naming more than one thing, where the pantry has some of it but not all —
 * "salt og peber" against a cupboard that has salt but has run out of pepper. Neither
 * answered for (the household still wants pepper) nor plainly new (it would silently
 * re-buy the salt), so `writeRecipesToList` asks rather than guessing either way.
 *
 * A line the pantry has *none* of is plainly new, and one it has *all* of — every part
 * stocked — is answered for exactly as a single-item line would be: see `stripStocked`.
 * Only the line stuck in between is ambiguous, which is deliberately the narrow case:
 * most presses never see the question at all.
 */
export type AmbiguousLine = { key: string; text: string; matched: string[] };

export function ambiguousLines(wanted: Map<string, string>, stocked: Set<string>): AmbiguousLine[] {
  const found: AmbiguousLine[] = [];
  for (const [key, text] of wanted) {
    if (stocked.has(key)) continue;
    const split = matchParts(text, stocked);
    if (split && split.matched.length > 0 && split.matched.length < split.parts.length) {
      found.push({ key, text, matched: split.matched });
    }
  }
  return found;
}

/**
 * The ingredients a recipe actually adds, and the ones the cupboard already answers for.
 *
 * Kept apart rather than merely filtered, because what was left out has to be said. A
 * line that quietly never arrives is indistinguishable from one the app forgot, and the
 * household that cannot tell those apart stops trusting the button — so the menu that
 * pressed it reports what the pantry covered, by name.
 *
 * `resolvedKeep` is which ambiguous lines a person has explicitly said to still add,
 * named by key — empty until `writeRecipesToList` has asked and been answered. An
 * ambiguous line not in it is covered, the same as if the whole thing were in stock:
 * that is the answer "leave it out" actually means.
 *
 * Pure, and given every side, so `tests/unit/pantry.test.ts` can hold the rule without a
 * database: the keys come from the pantry, the map is the recipe's own deduplicated
 * lines, keyed the same way.
 */
export function stripStocked(
  wanted: Map<string, string>,
  stocked: Set<string>,
  resolvedKeep: Set<string> = new Set(),
): { keep: Map<string, string>; covered: string[] } {
  const keep = new Map<string, string>();
  const covered: string[] = [];

  for (const [key, text] of wanted) {
    if (stocked.has(key)) {
      covered.push(text);
      continue;
    }

    const split = matchParts(text, stocked);
    if (split && split.matched.length > 0) {
      // Every part in stock answers for the line as fully as one entry keyed "salt og
      // peber" would; some but not all is covered only once resolved — unresolved,
      // `ambiguousLines` is what keeps this from being reached at all.
      const fullyBySplit = split.matched.length === split.parts.length;
      if (fullyBySplit || !resolvedKeep.has(key)) {
        covered.push(text);
        continue;
      }
    }

    keep.set(key, text);
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
export function namesInWords(names: string[], language: HomeLanguage): string {
  const say = sayIn(language);
  const named = names.slice(0, NAMED);
  const rest = names.length - named.length;
  const parts = rest > 0 ? [...named, say(PANTRY.andMore, { count: rest })] : named;

  if (parts.length === 1) return parts[0];
  return say(PANTRY.lastTwo, {
    most: parts.slice(0, -1).join(", "),
    last: parts[parts.length - 1],
  });
}

/**
 * What the pantry took care of, in words, or nothing at all where it took care of
 * nothing — which is what a successful press usually has to say for itself.
 */
export function pantryNote(covered: string[], language: HomeLanguage): string | undefined {
  if (covered.length === 0) return undefined;
  return sayIn(language)(PANTRY.covered, { names: namesInWords(covered, language) });
}

/**
 * The same sentence from the other end: what a restock run found the list already
 * saying, so a household that presses "Add to list" and sees two rows appear out of
 * five knows the other three were not lost.
 */
export function alreadyOnListNote(names: string[], language: HomeLanguage): string | undefined {
  if (names.length === 0) return undefined;
  return sayIn(language)(PANTRY.onList, { names: namesInWords(names, language) });
}

/**
 * What `writeRecipesToList` sends back instead of writing, the one time it has an
 * ambiguous line and hasn't yet been told what to do with it. Distinct from
 * `ActionResult` on purpose: this is not success or failure, it is the press stopping
 * short of either — nothing has been added yet, and `AddToListMenu` is what asks and
 * resubmits.
 */
export type PantryDecision = { needsDecision: true; lines: AmbiguousLine[] };

/**
 * Present once a person has been asked and answered: which ambiguous lines, by key, they
 * said to still add. Sent back on the form's second, confirmed submission — its mere
 * presence is what tells `writeRecipesToList` this is that submission, even where the
 * answer to every line was "no, leave it out" and the set is empty.
 */
export const PANTRY_CONFIRM_FIELD = "pantryConfirmed";
export const PANTRY_KEEP_FIELD = "pantryKeep";

export function readPantryKeep(formData: FormData): Set<string> | undefined {
  if (formData.get(PANTRY_CONFIRM_FIELD) !== "1") return undefined;
  return new Set(formData.getAll(PANTRY_KEEP_FIELD).map(String));
}
