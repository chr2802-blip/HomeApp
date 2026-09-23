import type { HomeLanguage, PantryUnit } from "@prisma/client";
import { shoppingText } from "./recipes";
import { sayIn } from "./copy/say";
import { PANTRY, PANTRY_UNIT_LABELS } from "./copy/pantry";

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
 * Every unit a pantry quantity may be counted in, in the order `PANTRY_UNIT_LABELS`
 * lists them — derived rather than written out again, the same reason `THEMES` is in
 * `src/lib/theme.ts`.
 */
export const PANTRY_UNITS = Object.keys(PANTRY_UNIT_LABELS) as [PantryUnit, ...PantryUnit[]];

/** Nothing a household keeps in needs four digits, and a typo should not become one. */
export const MAX_PANTRY_QUANTITY = 999;

/**
 * Brings any value into range, the same way `clampAmount` does for a list item's
 * amount — except the floor is zero rather than one, because zero is a pantry
 * quantity's own meaning ("run out"), not out-of-range input to be corrected away from.
 */
export function clampPantryQuantity(value: unknown): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return 0;
  return Math.min(MAX_PANTRY_QUANTITY, Math.max(0, rounded));
}

/** A unit this app actually offers, or nothing — what `setPantryQuantity` holds a
 *  submitted unit to, the same way a submitted theme is held to `THEMES`. */
export function isPantryUnit(value: string): value is PantryUnit {
  return (PANTRY_UNITS as readonly string[]).includes(value);
}

/**
 * The handful of ways a line names more than one thing — "salt og peber", "salt and
 * pepper", "salt & peber" — split apart only far enough to check each half against the
 * pantry separately. Nothing else reads a line this way: `ingredientLines` and the
 * recipe page still show it exactly as written, and the shopping list still carries it
 * as the one line it was typed as.
 */
const CONJUNCTION = /\s+(?:og|and)\s+|\s*&\s*/i;

/**
 * The stocked key that answers for `key` exactly, or, failing that, the longest run of
 * the key's own words, in order, that the pantry has an entry for: "tørret
 * spidskommen" is answered by a pantry that has "spidskommen" (a qualifier dropped from
 * the front), "hakkede tomater på dåse" by one that has "hakkede tomater" (a qualifier
 * dropped from the *back* — "på dåse" names the tin, not the tomato). A qualifier can
 * sit on either side of the ingredient it describes, so both ends are tried; the
 * longest run that matches wins, so a pantry holding both "tomater" and "hakkede
 * tomater" answers with the more specific one.
 *
 * Only whole words move, and only as a contiguous run — never a substring reaching
 * inside one. Danish compounds carry no space of their own ("hvidløg", "rødløg"), so a
 * pantry entry for "løg" is never mistaken for garlic or a red onion; it is still only
 * ever an exact match for "løg".
 *
 * The caller decides what a non-exact match is worth: `matchLine` below is the one
 * place that reads whether the key returned is `key` itself.
 */
function matchedStockedKey(key: string, stocked: Set<string>): string | null {
  if (stocked.has(key)) return key;
  const words = key.split(/\s+/).filter(Boolean);
  for (let length = words.length - 1; length > 0; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      const run = words.slice(start, start + length).join(" ");
      if (stocked.has(run)) return run;
    }
  }
  return null;
}

/** A stocked key, which is never typed, as the ambiguous dialog names it. */
function displayKey(key: string): string {
  return key.length === 0 ? key : key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * A line taken apart into whatever the pantry can say about it: a combined line's
 * halves, or the line whole where it names one thing, each checked through
 * `matchedStockedKey`.
 *
 * `fullyExact` is the only case `stripStocked` still leaves unquestioned — every part
 * matched, and matched *exactly*, the key as written and not a modifier stripped off
 * to find it. Anything else that matched at all — a lone "røget paprika" answered for
 * only by dropping "røget", or a combined line where some but not all halves are
 * stocked — is a match `stripStocked` still has to ask about rather than guess at
 * either way, because a modifier the household never typed into the pantry is not
 * something this file assumes means the same shelf.
 */
function matchLine(
  text: string,
  stocked: Set<string>,
): { matchedKeys: string[]; fullyExact: boolean } {
  const split = text
    .split(CONJUNCTION)
    .map((part) => part.trim())
    .filter(Boolean);
  const parts = split.length >= 2 ? split : [text];

  const matches = parts.map((part) => matchedStockedKey(pantryKey(part), stocked));
  const matchedKeys = matches.filter((key): key is string => key !== null);
  const fullyExact = matches.every((key, i) => key !== null && key === pantryKey(parts[i]));

  return { matchedKeys, fullyExact };
}

/**
 * A recipe line the pantry only partly answers for — "salt og peber" against a
 * cupboard that has salt but has run out of pepper, or a lone "røget paprika" answered
 * for only by dropping "røget" to find the pantry's own "paprika". Neither answered
 * for outright (a modifier the household never typed into the pantry is not assumed to
 * mean the same shelf) nor plainly new (it would silently re-buy the salt, or silently
 * hide a match that was probably meant), so `writeRecipesToList` asks rather than
 * guessing either way.
 *
 * A line the pantry has *none* of is plainly new, and one every part of which is
 * stocked *exactly* is answered for without asking: see `stripStocked`. Only the line
 * stuck in between is ambiguous, which is deliberately the narrow case: most presses
 * never see the question at all.
 */
export type AmbiguousLine = { key: string; text: string; matched: string[] };

export function ambiguousLines(wanted: Map<string, string>, stocked: Set<string>): AmbiguousLine[] {
  const found: AmbiguousLine[] = [];
  for (const [key, text] of wanted) {
    const { matchedKeys, fullyExact } = matchLine(text, stocked);
    if (fullyExact || matchedKeys.length === 0) continue;
    found.push({ key, text, matched: matchedKeys.map(displayKey) });
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
    const { matchedKeys, fullyExact } = matchLine(text, stocked);

    if (fullyExact) {
      covered.push(text);
      continue;
    }

    if (matchedKeys.length > 0) {
      // Matched, but not cleanly enough to answer for on its own — a modifier had to
      // be dropped to find it, or a combined line left some of itself unaccounted
      // for. Covered only once resolved — unresolved, `ambiguousLines` is what keeps
      // this from being reached at all.
      if (!resolvedKeep.has(key)) {
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
