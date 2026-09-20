/**
 * Turning a reel's own description into a recipe.
 *
 * A reel is a video with a paragraph under it, and the paragraph is almost always the
 * recipe — a cook who writes one out for Instagram writes the ingredients and the steps
 * in the caption, because there is nowhere else on that page to put them. What there
 * never is, is `schema.org/Recipe` markup: Meta publishes none, so `recipe-import.ts`'s
 * ordinary route reaches a page that is genuinely a recipe and correctly reports having
 * found nothing to cook from. This module is the second route for exactly that case.
 *
 * Everything here is text in and text out, with no network and no database, because the
 * part that can be wrong while the rest works is the reading — which line was a heading,
 * which was an ingredient, where the hashtags started. `tests/unit/caption-recipe.test.ts`
 * holds it to a page of real captions.
 *
 * It is deliberately shy: a caption it cannot recognise as a recipe is refused rather
 * than turned into a recipe whose ingredients are somebody's tagged friends. A cook who
 * is handed a form full of nonsense has to clear it out before typing the recipe in, so
 * a bad guess costs more than no guess at all — the same reasoning that makes
 * `parseRecipeFromHtml` refuse a page rather than scrape prose off it.
 */

export type CaptionRecipe = {
  title: string;
  ingredients: string;
  instructions: string;
  totalTimeMinutes: number | null;
};

/**
 * What a caption has to reach before it is read as a recipe at all, where it named no
 * heading: three lines that look like ingredients. Two is a phrase like "2 ting du skal
 * vide" followed by a number, and one is any sentence beginning with a digit.
 */
const INGREDIENTS_WITHOUT_HEADING = 3;

/** How long a line may be and still be read as a heading rather than as a sentence. */
const MAX_HEADING_LENGTH = 40;

/** How long a title may be before it is cut down to its first sentence. */
const MAX_TITLE_LENGTH = 80;

/**
 * The words a caption announces its ingredients with. Danish first, because that is the
 * language this household's reels are in; English beside it, because a good half of what
 * anybody saves is in English either way.
 */
const INGREDIENT_HEADINGS = new Set([
  "ingredienser",
  "ingrediens",
  "ingredients",
  "du skal bruge",
  "det skal du bruge",
  "dette skal du bruge",
  "du skal bruge følgende",
  "råvarer",
  "indkøbsliste",
  "indkobsliste",
  "you need",
  "you will need",
  "you'll need",
  "what you need",
  "what you'll need",
  "shopping list",
]);

/** The words a caption announces its method with. */
const INSTRUCTION_HEADINGS = new Set([
  "fremgangsmåde",
  "fremgangsmade",
  "sådan gør du",
  "sadan gor du",
  "sådan gør du det",
  "sådan gør man",
  "sådan laver du det",
  "sådan laver du den",
  "gør sådan",
  "tilberedning",
  "metode",
  "instruktioner",
  "trin for trin",
  "instructions",
  "method",
  "directions",
  "steps",
  "preparation",
  "how to",
  "how to make it",
  "step by step",
]);

/**
 * Lines that are about the post rather than about the dinner. Kept short on purpose:
 * every phrase here is one a real instruction could in principle contain, so the list
 * earns its place only where the whole line is the phrase and nothing else is lost.
 */
const PROMOTIONAL = [
  /^link (in|i) bio\b/i,
  /^opskrift(en)? (i|in) bio\b/i,
  /^(følg|folg) (mig|med|os)\b/i,
  /^follow (me|us|for more)\b/i,
  /^(gem|save) (den|dette|this|the recipe|opskriften)\b/i,
  /^(dobbelt|double)[- ]?tap\b/i,
  /^swipe\b/i,
];

/** Emoji, variation selectors and the zero-width characters a paste drags along. */
const DECORATION =
  /[\p{Extended_Pictographic}\u{FE0E}\u{FE0F}\u{200B}-\u{200D}\u{2060}\u{FEFF}\u{1F3FB}-\u{1F3FF}]/gu;

/** The glyphs a caption starts a bullet with, before the thing being listed. */
const BULLET = /^[\s\-–—•·▪◾◽▫‣*+>→»]+/u;

/** "1." or "2)" at the start of a step, which the recipe page numbers itself anyway. */
const STEP_NUMBER = /^\d{1,2}\s*[.)]\s+/;

/**
 * A caption's own line breaks, with the characters that are not language removed.
 * Instagram stores a caption as plain text with real newlines in it, so this is only
 * ever tidying: no markup arrives here.
 */
function contentLines(caption: string): string[] {
  return caption
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(DECORATION, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && !isNoise(line));
}

/**
 * A line carrying nothing about the food: the block of hashtags at the end, a row of
 * tagged accounts, a bare link, or one of the phrases above asking for a follow.
 *
 * Hashtags are checked as a whole line rather than stripped from every line, because a
 * caption that writes "#pasta" mid-sentence is using the word.
 */
function isNoise(line: string): boolean {
  const withoutTags = line.replace(/[#@][\p{L}\p{N}_.]+/gu, " ").trim();
  if (withoutTags.length === 0) return true;
  if (/^(https?:\/\/|www\.)\S+$/i.test(line)) return true;
  return PROMOTIONAL.some((pattern) => pattern.test(line));
}

/**
 * A line reduced to the words a heading would be made of: no bullet, no emoji, no
 * colon, no trailing "(til 4 personer)". What is left is compared against the two sets
 * above by equality rather than by containment — "ingredienser" is a heading and "de
 * fleste ingredienser kan byttes ud" is a sentence about ingredients, and a rule that
 * cannot tell them apart would cut the recipe in half at the wrong line.
 */
function headingText(line: string): string {
  if (line.length > MAX_HEADING_LENGTH) return "";
  return line
    .replace(BULLET, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(til|for|to)\s+\d+\s*\p{L}*\.?\s*$/u, " ")
    .replace(/[\s:：.!?_*–—-]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingKind(line: string): "ingredients" | "instructions" | null {
  const text = headingText(line);
  if (!text) return null;
  if (INGREDIENT_HEADINGS.has(text)) return "ingredients";
  if (INSTRUCTION_HEADINGS.has(text)) return "instructions";
  return null;
}

/**
 * A line opening with an amount — "500 g hakket oksekød", "½ citron", "2 æg". This is
 * the one signal here strong enough to stand on its own: a caption's first line
 * beginning this way is the shopping already begun, not the dish's name.
 */
function startsWithQuantity(line: string): boolean {
  return /^[\d½¼¾⅓⅔⅛]/.test(line.replace(BULLET, "").trim());
}

/**
 * Whether a line reads as something to buy rather than something to do. Used only where
 * the caption named no heading, which is the case this cannot be certain about: a
 * quantity at the front is the strong signal, and a short line of a few words with no
 * full stop is the weak one — "Frisk basilikum" is an ingredient and "Kom det hele i en
 * gryde og lad det simre" is a step, and length is most of what separates them.
 */
function looksLikeIngredient(line: string): boolean {
  const text = line.replace(BULLET, "").trim();
  if (text.length === 0) return false;
  if (startsWithQuantity(text)) return true;
  if (text.length > 45) return false;
  if (/[.!?:]$/.test(text)) return false;
  return text.split(/\s+/).length <= 6;
}

/** A bullet's glyph taken off, for a line that is being stored as an ingredient. */
function cleanIngredient(line: string): string {
  return line.replace(BULLET, "").trim();
}

/** The same, plus the step's own number: the recipe page lists the lines in order. */
function cleanInstruction(line: string): string {
  return line.replace(BULLET, "").replace(STEP_NUMBER, "").trim();
}

/**
 * A caption's first line as a title, cut to its first sentence where the caption opens
 * with a paragraph instead. A reel's caption very often begins with the dish's name on
 * a line of its own, which is the best title anything here is going to find — better
 * than Instagram's own `og:title`, which is the account's name and the first few words.
 */
function titleFrom(line: string): string {
  const text = line.replace(BULLET, "").replace(/[\s:：|–—-]+$/u, "").trim();
  if (text.length <= MAX_TITLE_LENGTH) return text;

  const sentence = /^(.{10,80}?)[.!?]\s/.exec(text);
  if (sentence) return sentence[1].trim();

  const cut = text.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

/**
 * How long the dish takes, but only where the caption says so in as many words.
 *
 * A number of minutes on its own is nearly always a step's own timing — "bag i 20 min"
 * — and recording that as the recipe's total would put a two-hour braise on the
 * `/recipes` quick filter. So a duration counts only next to a phrase that means the
 * whole dish, which is the same judgement `combinedTimeMinutes` makes about a page that
 * publishes no `totalTime`: nothing said is null, never zero.
 */
const TOTAL_TIME_LABEL =
  /(i alt|samlet|total(?: time)?|tilberedningstid|klar (?:på|om)|klar til|færdig (?:på|om)|ready in|done in|takes about|tager (?:ca\.?|kun)?)/i;

/** Every duration a caption writes, in the shapes a caption writes them in. */
const DURATION =
  /(\d+(?:[.,]\d+)?)\s*(?:t\b|timer?\b|h\b|hrs?\b|hours?\b|min\b|min\.|minut(?:ter)?\b|minutes?\b|mins\b)/gi;

/**
 * A line that is the total time and nothing else — "Klar på 25 minutter i alt!", or
 * "Tilberedningstid: 2 timer og 30 min". It is dropped from the body once it has been
 * read, because the time is a field of its own on the form and the line is not a step:
 * left in, every such caption ends with an instruction telling the cook how long the
 * thing they have just made takes.
 *
 * What makes it that line rather than a step that happens to mention the total is how
 * little is left of it once the label and the duration are taken out — "Lad det simre i
 * 10 min i alt og smag til" still has a sentence in it and stays.
 */
function isTotalTimeLine(line: string): boolean {
  if (!TOTAL_TIME_LABEL.test(line)) return false;

  const rest = line
    .replace(new RegExp(TOTAL_TIME_LABEL.source, "gi"), " ")
    .replace(DURATION, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return rest.length <= 8;
}

function totalTimeFrom(lines: string[]): number | null {
  for (const line of lines) {
    if (!TOTAL_TIME_LABEL.test(line)) continue;

    const hours = /(\d+(?:[.,]\d+)?)\s*(?:t\b|timer?\b|h\b|hrs?\b|hours?\b)/i.exec(line);
    const minutes = /(\d+)\s*(?:min\b|min\.|minut(?:ter)?\b|minutes?\b|mins\b)/i.exec(line);
    if (!hours && !minutes) continue;

    const total =
      Number(hours?.[1].replace(",", ".") ?? 0) * 60 + Number(minutes?.[1] ?? 0);
    if (total > 0) return Math.round(total);
  }
  return null;
}

/** Where each heading sits in the caption, so the body can be cut at the right lines. */
function headingIndex(lines: string[], kind: "ingredients" | "instructions"): number {
  return lines.findIndex((line) => headingKind(line) === kind);
}

/**
 * Reads a reel's caption as a recipe, or refuses it.
 *
 * Two shapes, and the first is most of what arrives: a caption with its own headings —
 * "Ingredienser" and "Fremgangsmåde", or the English pair — which says exactly where
 * the split is and is simply obeyed. Failing that, the shape of the lines themselves
 * decides: a run of short, quantity-led lines at the top is the shopping and the prose
 * under it is the method, and a caption with fewer than three such lines is not a
 * recipe at all and is refused rather than guessed at.
 *
 * `fallbackTitle` is whatever the page itself said it was — Instagram's `og:title`,
 * usually — and is used only where the caption names no dish of its own, which is a
 * caption opening straight into a heading or straight into a quantity.
 */
export function parseRecipeFromCaption(
  caption: string,
  fallbackTitle = "",
): CaptionRecipe | null {
  const read = contentLines(caption);
  if (read.length === 0) return null;

  // The time is read before the line saying it is taken out, because it is that line
  // that says it — and taken out before anything else, so it cannot be read as a step.
  const totalTimeMinutes = totalTimeFrom(read);
  const lines = read.filter((line) => !isTotalTimeLine(line));
  if (lines.length === 0) return null;

  const ingredientsAt = headingIndex(lines, "ingredients");
  const instructionsAt = headingIndex(lines, "instructions");
  const firstHeadingAt = Math.min(
    ingredientsAt >= 0 ? ingredientsAt : lines.length,
    instructionsAt >= 0 ? instructionsAt : lines.length,
  );

  // The first line is the dish's name unless it is plainly part of the recipe already:
  // a heading, or a quantity. Either way the caption has not named the dish, and the
  // page's own title is all there is left to call it.
  const opensWithTheRecipe = firstHeadingAt === 0 || startsWithQuantity(lines[0]);
  const title = (opensWithTheRecipe ? "" : titleFrom(lines[0])) || titleFrom(fallbackTitle);
  if (!title) return null;

  const body = opensWithTheRecipe ? lines : lines.slice(1);
  const { ingredients, instructions } = splitBody(body);

  if (!ingredients && !instructions) return null;
  return { title, ingredients, instructions, totalTimeMinutes };
}

/**
 * The caption below its title, cut into the two halves the form has fields for.
 *
 * A heading is obeyed where there is one, since the cook who wrote it has already
 * answered the only hard question here. Where only one of the pair was written, the
 * other half is whatever is left on the far side of it — and where neither was, the
 * shape of the lines is all there is to go on, so the bar is set at
 * `INGREDIENTS_WITHOUT_HEADING`: below that this is reading a paragraph as a shopping
 * list, which is the guess that costs a cook more than no guess at all.
 */
function splitBody(body: string[]): { ingredients: string; instructions: string } {
  const ingredientsAt = headingIndex(body, "ingredients");
  const instructionsAt = headingIndex(body, "instructions");

  const ingredients: string[] = [];
  const instructions: string[] = [];

  if (ingredientsAt >= 0) {
    // Everything after the shopping's heading, up to the method's where the caption
    // wrote one and up to the first line that stops reading as shopping where it did not.
    const after = body.slice(ingredientsAt + 1);
    const end =
      instructionsAt > ingredientsAt
        ? instructionsAt - ingredientsAt - 1
        : runOfIngredients(after);
    for (const line of after.slice(0, end)) ingredients.push(cleanIngredient(line));
    for (const line of after.slice(instructionsAt > ingredientsAt ? end + 1 : end)) {
      instructions.push(cleanInstruction(line));
    }
  } else if (instructionsAt >= 0) {
    // Only a method heading: everything above it that reads as shopping is the shopping.
    for (const line of body.slice(0, instructionsAt)) {
      if (looksLikeIngredient(line)) ingredients.push(cleanIngredient(line));
    }
    for (const line of body.slice(instructionsAt + 1)) instructions.push(cleanInstruction(line));
  } else {
    const end = runOfIngredients(body);
    if (end < INGREDIENTS_WITHOUT_HEADING) return { ingredients: "", instructions: "" };
    for (const line of body.slice(0, end)) ingredients.push(cleanIngredient(line));
    for (const line of body.slice(end)) instructions.push(cleanInstruction(line));
  }

  return {
    ingredients: ingredients.filter(Boolean).join("\n"),
    instructions: instructions.filter(Boolean).join("\n"),
  };
}

/** How many lines from the top of a block read as things to buy rather than to do. */
function runOfIngredients(lines: string[]): number {
  let count = 0;
  while (count < lines.length && looksLikeIngredient(lines[count])) count += 1;
  return count;
}
