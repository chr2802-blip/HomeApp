import { z } from "zod";

import { ingredientLines, instructionLines } from "@/lib/recipes";

/**
 * Reading a recipe as something to cook rather than something to read.
 *
 * A recipe page answers "what does this contain". Action mode answers "what am I doing
 * now, and what do I need in front of me for it" — and that second question needs
 * something the two text blocks cannot say, because nothing in `ingredients` points at
 * anything in `instructions`. `Recipe.cookSteps` is that pointing, written by
 * `prepareCookSteps` and read back here.
 *
 * Everything in this file is pure. The one job it has beyond splitting lines is to
 * refuse a breakdown it cannot trust: a mapping that has fallen out of step with the
 * recipe would put the wrong ingredients under a step, at the hob, silently — which is
 * worse than showing none at all. So the guards below throw the whole thing away on any
 * disagreement rather than salvaging part of it.
 */

/**
 * The version a breakdown is written with once the recipe it describes has been read into
 * the one ingredient format (`ingredient-line.ts`). Version 1 is everything written
 * before that format existed — still a perfectly good breakdown for action mode, but the
 * recipe's lines were never tidied, so its next save reads it.
 *
 * Kept in the breakdown rather than a column of its own because the two are one fact: a
 * breakdown is written by the same reading that tidied the lines, and cleared by any save
 * the reader could not answer. A flag beside it could say "tidied" about a recipe whose
 * breakdown had just been cleared.
 */
export const IN_FORMAT = 2;

/**
 * Whether a recipe's text is known to be in the one ingredient format already — which is
 * what lets a save that leaves its ingredients and steps alone skip the reader entirely.
 */
export function isInFormat(cookSteps: unknown): boolean {
  const read = StoredSteps.safeParse(cookSteps);
  return read.success && read.data.v === IN_FORMAT;
}

/** What a stored reading covers: the text it read, and whether that text is in the format. */
export type SavedReading = { ingredients: string; instructions: string; inFormat: boolean };

/** Two blocks of recipe text as the reader sees them: the same lines, ignoring a
 *  textarea's `\r\n` and blank lines. */
function sameLines(a: string, b: string) {
  const left = ingredientLines(a);
  const right = ingredientLines(b);
  return left.length === right.length && left.every((line, index) => line === right[index]);
}

/**
 * Whether a reading already stands for what is being saved: text already read into the
 * format, and ingredients and steps left line for line as they were. A title, a picture or
 * a category is nothing the reader looks at. This is what lets `updateRecipe` skip the
 * reader — and a recipe never read in the format (`inFormat` false) is read whatever the
 * edit, which is how one stored before the format existed is brought in.
 */
export function readingStands(
  submitted: { ingredients: string; instructions: string },
  saved: SavedReading | null | undefined,
): boolean {
  return Boolean(
    saved?.inFormat &&
      sameLines(submitted.ingredients, saved.ingredients) &&
      sameLines(submitted.instructions, saved.instructions),
  );
}

/**
 * Whether saving this spends a model call — **the question the AI wait asks**, so it is
 * drawn only for a save the AI is actually working on. It is `readingStands` turned round,
 * the rule the save itself skips the reader by, plus the one other case the reader answers
 * without the model: a recipe with no ingredients and no steps has nothing to read.
 */
export function needsReading(
  submitted: { ingredients: string; instructions: string },
  saved: SavedReading | null | undefined,
): boolean {
  const anything = ingredientLines(submitted.ingredients).length || instructionLines(submitted.instructions).length;
  return Boolean(anything) && !readingStands(submitted, saved);
}

/** The shape stored in `Recipe.cookSteps`, as written. Nothing here narrows: the column
 *  is read back defensively below, because a row written by an older version of this
 *  app is exactly the case the guards exist for. */
const StoredSteps = z.object({
  v: z.union([z.literal(1), z.literal(IN_FORMAT)]),
  steps: z.array(
    z.object({
      uses: z.array(z.number()).nullish(),
      minutes: z.number().nullish(),
    }),
  ),
});

export type StoredStep = { uses: number[]; minutes: number | null };

/** One page of action mode: what to do, what it needs, and how long it takes. */
export type CookStep = {
  text: string;
  /** The recipe's own ingredient lines, verbatim — never a rewording of them. */
  ingredients: string[];
  minutes: number | null;
};

type RecipeText = {
  ingredients: string;
  instructions: string;
  cookSteps: unknown;
};

/**
 * The stored breakdown, or null where there is nothing usable.
 *
 * **The count is the guard.** A breakdown describes the instruction lines it was made
 * from, in order, so one holding a different number of entries than the recipe now has
 * lines is describing a recipe that has since been edited. There is no way to tell which
 * of its entries still line up, so none of them is used. In practice this should never
 * fire — every save that changes either block rewrites this column — and that is the
 * point: it is the net under an invariant, not the mechanism that keeps it.
 */
function storedSteps(recipe: RecipeText, stepCount: number): StoredStep[] | null {
  if (recipe.cookSteps === null || recipe.cookSteps === undefined) return null;

  const read = StoredSteps.safeParse(recipe.cookSteps);
  if (!read.success) return null;
  if (read.data.steps.length !== stepCount) return null;

  const ingredientCount = ingredientLines(recipe.ingredients).length;

  return read.data.steps.map((step) => ({
    // An index past the end of the ingredients is dropped rather than shown as a blank
    // line: it names an ingredient this recipe does not have.
    uses: [...new Set(step.uses ?? [])]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < ingredientCount)
      .sort((a, b) => a - b),
    minutes: cookMinutes(step.minutes),
  }));
}

/** A duration worth offering a timer for, or null. Zero, a negative and a fraction of a
 *  minute all mean "the text did not say" — the same coercion `cookingMinutes` does for
 *  a recipe's total time, and for the same reason: a wrong value costs one chip. */
function cookMinutes(minutes: number | null | undefined): number | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return null;
  const rounded = Math.round(minutes);
  return rounded > 0 ? rounded : null;
}

/**
 * A recipe's steps, with whatever the breakdown could tell us about each.
 *
 * A recipe that was never prepared — everything in the database before action mode
 * existed, and anything saved while the reader was unavailable — still cooks: it comes
 * back as its steps with no ingredients and no timers. That is honest degradation and
 * not a second guess; guessing which ingredients a step uses by matching words against
 * it is the pattern-matching this app has already been wrong with once.
 */
export function cookSteps(recipe: RecipeText): CookStep[] {
  const steps = instructionLines(recipe.instructions);
  const stored = storedSteps(recipe, steps.length);
  const lines = ingredientLines(recipe.ingredients);

  return steps.map((text, index) => {
    const step = stored?.[index];
    return {
      text,
      ingredients: (step?.uses ?? []).map((line) => lines[line]),
      minutes: step?.minutes ?? null,
    };
  });
}

/**
 * Whether this recipe's breakdown is there and usable — what decides between cooking it
 * as it stands and offering to prepare it first.
 *
 * A recipe whose every step genuinely uses nothing (a two-line "heat the oven, wait") is
 * indistinguishable from an unprepared one here, and that is the right answer: there is
 * nothing for preparing it to add either.
 */
export function isPrepared(recipe: RecipeText): boolean {
  return storedSteps(recipe, instructionLines(recipe.instructions).length) !== null;
}

/** A running timer's remaining seconds as a clock reads them — "9:05", "12:00". */
export function clockLabel(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}
