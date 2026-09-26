import { z } from "zod";
import type { HomeLanguage } from "@prisma/client";
import { UNIT_WORDS } from "./recipes";

/**
 * What an ingredient line is, for every recipe in the app however it arrived.
 *
 * **A line is an amount, a unit and the thing bought — and nothing else.** "100 g
 * kartofler", "2 æg", "Salt". How it is cut, what temperature it should be, how big it
 * is, whether it is optional, what it may be swapped for: all of that is something the
 * cook *does* or *decides*, and it lives in the steps. That is what lets the shopping
 * list, the pantry and the meal suggestions read a line as the thing to buy without a
 * second opinion about which words to throw away.
 *
 * Two model calls write lines — the importer (`recipe-normalize.ts`), which pre-fills
 * the form from a link, a reel or a paste, and the save (`cook-steps.ts`), which reads
 * every recipe the household stores, typed or imported. Both are handed the **same**
 * rules (`ingredientRules`), answer in the **same** shape (`IngredientSchema`) and are
 * written out by the **same** function (`renderIngredient`). That is the whole of "one
 * way": there is one description of a line and one writer of it, asked from two places.
 * The save is the one that decides what is stored, so an import's draft read a second
 * time comes back as it went in.
 *
 * Nothing here calls the model, so the unit tests import it freely.
 */

/**
 * The units a line may be written in — **every one of them a word `shoppingText` already
 * knows**, and that is the whole point of the list.
 *
 * `shoppingText` (`src/lib/recipes.ts`) strips a leading amount and then a unit word it
 * recognises, and what is left is what lands on the shopping list; `pantryKey` is that
 * same text lower-cased. So a model writing "2 tablespoons salt" produces a shopping row
 * reading "Tablespoons salt", which matches no pantry entry and never merges with the
 * "Salt" the last recipe added.
 *
 * Metric only, plus the spoons and the kitchen's counted measures: a cup, an ounce and a
 * pound are converted by the reader (see `ingredientRules`), so they are not offered.
 * `stk` is not offered either — a counted thing is written with its number alone ("2
 * æg"), and `renderIngredient` drops a `stk` that arrives anyway.
 *
 * **This list is what the model is offered, not what it is held to.** The SDK converts
 * the schema for the wire and drops the constraints the API's format cannot carry — an
 * enum comes out the far side as a plain string. So the check that matters is
 * `canonicalUnit`, on the way back, against `UNIT_WORDS` itself.
 */
export const UNITS = [
  "g",
  "kg",
  "dl",
  "cl",
  "ml",
  "l",
  "tsk",
  "spsk",
  "fed",
  "dåse",
  "pakke",
  "glas",
  "bundt",
  "skive",
  "håndfuld",
  "knivspids",
  "tsp",
  "tbsp",
  "clove",
  "can",
  "slice",
  "bunch",
  "pinch",
] as const;

/**
 * One ingredient as a reader answers it: what is bought, how much, in what unit. An
 * ingredient appears once however many parts of the dish use it, so there is no field
 * saying which part — the steps say how much goes where.
 *
 * The same two traps as every schema sent to the model, and both are load-bearing:
 * nothing narrows a value (the SDK validates the answer against this original schema, so
 * a constraint the wire could not carry is one the model can innocently break, losing the
 * whole answer), and every `.describe()` comes before its `.nullish()` (the other way
 * round the description is hoisted away and never reaches the model).
 *
 * There is deliberately no field for preparation or a note. A field is a place to put
 * something, and a place on the ingredient is exactly what this contract takes away.
 */
export const IngredientSchema = z.object({
  name: z
    .string()
    .describe(
      "What is bought, and only that: 'kartofler', 'hakkede tomater', 'græsk yoghurt 10%'. No amount, no unit, no preparation, no size, no state, no 'efter smag', no alternative, no commas and no brackets.",
    )
    .nullish(),
  amount: z
    .number()
    .describe(
      "How much, as a decimal — 1.5, never '1 1/2'. For a range, the higher number. Null for anything unmeasured.",
    )
    .nullish(),
  unit: z
    .string()
    .describe(
      `Exactly one of: ${UNITS.join(", ")}. Null for counted things ('2 æg') and for anything unmeasured.`,
    )
    .nullish(),
});

export type ParsedIngredient = z.infer<typeof IngredientSchema>;

/**
 * What each language is called in the prompts' own words, so an instruction reads as
 * English prose rather than naming an enum member at the model.
 */
const LANGUAGE_NAME: Record<HomeLanguage, string> = { EN: "English", DA: "Danish" };

/**
 * The language rule, shared by both readers: whichever language the source was written
 * in, the recipe is stored in the household's. A recipe typed by hand is translated
 * exactly as an import is — every recipe in a home reads in that home's language.
 *
 * Which *word* a unit is written with is carved out. That is decided afterwards,
 * deterministically, by `renderIngredient` through `SAME_MEASURE` — never by the model
 * guessing at a spelling with one right answer.
 */
export function languageRules(language: HomeLanguage): string {
  const name = LANGUAGE_NAME[language];
  return `### Language
Write the recipe in ${name} — the title, every ingredient name, every step, and any sentence meant for the cook. Where the text is already in ${name}, keep its own wording rather than paraphrasing it. Where it is written in another language, translate it, the way a cook would explain the same dish to someone who reads only ${name}.
Never translate a unit word on its own — which word a unit is spelled with is decided afterwards, not by you.`;
}

/**
 * The ingredient rules, word for word the same for both readers. Each bullet is one of
 * the household's own decisions about where a kind of extra word goes; together they
 * leave nothing on a line but what `renderIngredient` writes.
 *
 * Written in the prompt with Danish examples because that is what this household's
 * recipes are in; the rules themselves apply in either language.
 */
export function ingredientRules(): string {
  return `### Ingredients: amount, unit, the thing bought — nothing else
Every ingredient is answered as \`name\`, \`amount\` and \`unit\`, and **nothing else is stored about it**. Anything more the text says about an ingredient must end up in the steps, or it is lost.

- **\`name\` is what is bought.** Keep every word that changes which product is taken off the shelf: "hakkede tomater", "røget paprika", "græsk yoghurt 10%", "kyllingebryst uden skind", "hvedemel". Drop every word about what the cook does to it or how much of it there is. No commas and no brackets in a name.
- **Preparation moves to the steps.** "2 kartofler, i tern" is \`name: "kartofler"\`, and a step says to dice them. First check whether a step already says it — in any wording, any inflection ("lunkne" in a step covers "lunkent" on the ingredient), or as the same action described another way. If none does, add it to the step where the ingredient is first used, or write a new step just before that one.
- **States move to the steps too.** "Smør, stuetemperatur", "æg, stuetempererede", "smeltet smør": the line is only "smør" / "æg", and a step says it — "Tag smørret ud i god tid, så det får stuetemperatur" at the start, or "Smelt smørret" where it is used — unless a step already does.
- **Sizes move to the steps.** "1 stort løg" is \`amount: 1, name: "løg"\`, and the step that uses it says "det store løg".
- **Unmeasured things are the name alone.** "Salt, efter smag" and "friskkværnet peber" are \`name: "salt"\` / \`name: "peber"\` with \`amount\` and \`unit\` null. The seasoning goes in the step that seasons ("Smag til med salt og friskkværnet peber"); if no step does, add one where it belongs.
- **Optional and serving items are still ingredients.** "Parmesan til servering" is \`name: "parmesan"\`, and a step says "Server med parmesan". "Evt. chili" is \`name: "chili"\`, and the step that uses it says "Tilføj evt. chili".
- **An alternative keeps its first option.** "Smør eller olie" is \`name: "smør"\`, and the step that uses it names the other: "Steg i smør (eller olie)".
- **One ingredient per line.** "Salt og peber" is two ingredients, "salt" and "peber". "Olie og smør til stegning" is "olie" and "smør".
- **Amounts are decimals**: "1 1/2" and "1½" are both 1.5. **A range takes the higher number** — "2-3 fed hvidløg" is 3 — and the range itself is not kept anywhere.
- **Counted things have no unit**: "2 æg", "3 kartofler". Leave \`unit\` null even where the text wrote "stk".
- **Units are metric.** Keep g, kg, dl, cl, ml, l, tsk, spsk, tsp, tbsp and the kitchen's own measures (fed, dåse, pakke, glas, bundt, skive, håndfuld, knivspids) exactly as written. Convert cups, ounces, pounds, pints, fluid ounces and sticks of butter to metric: weigh what a metric cook weighs (flour, sugar, butter, cheese) in g, and measure liquids in dl or ml, rounding to an amount a cook would write. Where the text gives two measures for one ingredient ("1 dåse hakkede tomater (400 g)"), keep the metric one: \`amount: 400, unit: "g"\`.
- **Each ingredient appears once in the whole recipe.** The same ingredient listed twice — in one part of the dish, or in two ("50 g smør" til dejen and "100 g smør" til fyldet) — is one ingredient with the amounts added together: "150 g smør". The steps then say how much goes where: "Tilsæt 50 g af smørret til dejen", "Brug resten af smørret (100 g) til fyldet". Where the two are in different units, convert one into the other before adding — exactly where the units are of the same kind (1 kg + 200 g is 1.2 kg; 1 spsk + 1 tsk is 4 tsk), and the way a metric cook would where one is weighed and the other measured by volume (1 spsk smør is about 15 g) — so the total is never less than the recipe uses.
- **A heading is never an ingredient.** "Til dressingen:" is not a line; the steps that belong to it say so.`;
}

/**
 * The same measure, under the word the household's own language spells it with —
 * `tsp`↔`tsk`, `tbsp`↔`spsk`, and so on. Deterministic and run after the model, never
 * inside the prompt: which word a unit is written in has one right answer, and asking a
 * model to translate it is asking it to guess.
 *
 * Converting a cup into decilitres is a different question — how much of this ingredient
 * a metric kitchen would measure — and that one *is* the reader's, because it depends on
 * what is being measured. This table only ever respells.
 */
export const SAME_MEASURE: Record<HomeLanguage, Record<string, string>> = {
  DA: {
    tsp: "tsk",
    teaspoon: "tsk",
    teaspoons: "tsk",
    tbsp: "spsk",
    tablespoon: "spsk",
    tablespoons: "spsk",
    clove: "fed",
    cloves: "fed",
    can: "dåse",
    cans: "dåse",
    slice: "skive",
    slices: "skive",
    bunch: "bundt",
    pinch: "knivspids",
  },
  EN: {
    tsk: "tsp",
    spsk: "tbsp",
    fed: "clove",
    dåse: "can",
    dåser: "can",
    skive: "slice",
    skiver: "slice",
    bundt: "bunch",
    knivspids: "pinch",
  },
};

/** The words that mean "this many of them", which a counted line is written without. */
const COUNT_WORDS = new Set(["stk", "styk", "stykker"]);

/**
 * One ingredient written as the line this app stores: `amount unit name`, the unit only
 * behind an amount, or `""` for an answer with no name, which the caller drops.
 *
 * **A unit is only ever written behind an amount.** "1 knivspids salt" is a measurement
 * and "knivspids salt" is a thing to buy called knivspids salt — `shoppingText` strips a
 * unit word only where an amount preceded it.
 *
 * **The name is made safe to take apart.** `shoppingText` cuts a line at its first comma,
 * so a comma inside a name would cut the product in half ("græsk yoghurt, 10%" would shop
 * as "Græsk yoghurt"); brackets would travel onto the list and match nothing in the
 * pantry. The rules forbid both, and this makes the forbidding true.
 */
export function renderIngredient(item: ParsedIngredient, language: HomeLanguage): string {
  const name = cleanName(item.name);
  if (!name) return "";

  const unit = canonicalUnit(item.unit);
  const localised = unit ? localUnit(unit, language) : null;

  const amount = typeof item.amount === "number" ? formatAmount(item.amount, language) : "";
  const measure = amount ? [amount, localised ?? ""].filter(Boolean).join(" ") : "";

  return measure ? `${measure} ${name}` : name;
}

function cleanName(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[()[\]]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `unit`, spelled the way this household's own language writes that measure. */
function localUnit(unit: string, language: HomeLanguage): string {
  return SAME_MEASURE[language][unit] ?? unit;
}

/**
 * A unit this app can actually take apart again, or nothing.
 *
 * `UNIT_WORDS` is asked rather than `UNITS`, because the question is not "is this one of
 * the ones we suggested" but "can `shoppingText` strip this off the front of a line". A
 * unit it cannot would become part of the thing being bought, so it is dropped rather
 * than refused: losing the whole recipe over one wrong word would be pedantry at the
 * cook's expense. `stk` is dropped too, because a counted line is its number alone.
 */
function canonicalUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const unit = raw.trim().toLowerCase().replace(/\.$/, "");
  if (COUNT_WORDS.has(unit)) return null;
  return UNIT_WORDS.has(unit) ? unit : null;
}

/**
 * The fractions a kitchen writes, and the glyphs `shoppingText`'s own amount pattern
 * already recognises.
 */
const FRACTIONS: [number, string][] = [
  [0.5, "½"],
  [0.25, "¼"],
  [0.75, "¾"],
  [1 / 3, "⅓"],
  [2 / 3, "⅔"],
];

/** How close a decimal has to be to a third before it is written as one. */
const FRACTION_TOLERANCE = 0.02;

/**
 * An amount as a cook writes it. "1.5" is how a model answers and "1½" is what belongs
 * on the page; anything else is written with the household's own decimal separator — a
 * comma in Danish, a point in English — which `shoppingText` reads either way.
 */
function formatAmount(amount: number, language: HomeLanguage): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const whole = Math.floor(amount);
  const rest = amount - whole;

  const fraction = FRACTIONS.find(([value]) => Math.abs(rest - value) < FRACTION_TOLERANCE);
  if (fraction) return whole === 0 ? fraction[1] : `${whole}${fraction[1]}`;
  if (rest < FRACTION_TOLERANCE) return String(whole);

  const rounded = String(Number(amount.toFixed(2)));
  return language === "DA" ? rounded.replace(".", ",") : rounded;
}

/** What each fraction glyph a stored line may start with is worth. */
const GLYPH_VALUE: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅖": 2 / 5,
  "⅗": 3 / 5,
  "⅘": 4 / 5,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅐": 1 / 7,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};
const GLYPHS = Object.keys(GLYPH_VALUE).join("");

/**
 * One quantity as a line may start with it: "1 1/2", "3/4", "1,5", "2½", "½". Mixed
 * numbers first, because "1 1/2" read as "1" would leave "1/2" behind as part of the name.
 */
const QUANTITY = String.raw`(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?\s*[${GLYPHS}]?|[${GLYPHS}])`;
/** A quantity or a range of two, followed by the rest of the line. */
const LEADING_QUANTITY = new RegExp(`^(${QUANTITY})(?:\\s*[-–]\\s*(${QUANTITY}))?(?=\\s|$)`);

function quantityValue(text: string): number | null {
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(text);
  if (mixed) return Number(mixed[3]) === 0 ? null : Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\/(\d+)$/.exec(text);
  if (fraction) return Number(fraction[2]) === 0 ? null : Number(fraction[1]) / Number(fraction[2]);

  const glyph = text.at(-1)!;
  const glyphValue = GLYPH_VALUE[glyph] ?? 0;
  const digits = (glyphValue ? text.slice(0, -1) : text).trim().replace(",", ".");
  const value = (digits ? Number(digits) : 0) + glyphValue;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * An amount as scaling leaves it: whole grams and millilitres rather than "333,33 g",
 * and two decimals below ten — which `formatAmount` then writes as the fraction a cook
 * would, where it is one.
 */
function kitchenRound(value: number): number {
  return value >= 10 ? Math.round(value) : Math.round(value * 100) / 100;
}

/**
 * One stored ingredient line with its amount multiplied by `factor` — how the recipe page
 * and action mode show a recipe cooked for more or fewer people than it was written for.
 *
 * Only the leading amount moves; the unit and the thing bought are left exactly as
 * stored, and so is a line with no amount at all ("Salt"), since "salt to taste" for
 * eight is still salt to taste. A range left over from before every line was read into
 * one format scales at both ends. Nothing here is ever written back: the stored lines are
 * the recipe as written, and scaling 4 → 3 → 4 has to land where it started.
 */
export function scaleIngredient(line: string, factor: number, language: HomeLanguage): string {
  if (factor === 1 || !Number.isFinite(factor) || factor <= 0) return line;
  const match = LEADING_QUANTITY.exec(line);
  if (!match) return line;

  const low = quantityValue(match[1]);
  const high = match[2] ? quantityValue(match[2]) : null;
  if (low === null || (match[2] && high === null)) return line;

  const write = (value: number) => formatAmount(kitchenRound(value * factor), language) || "0";
  const amount = high === null ? write(low) : `${write(low)}-${write(high)}`;
  return amount + line.slice(match[0].length);
}
