import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NormalizedRecipeSchema, renderNormalized, type NormalizedRecipe } from "@/lib/recipe-normalize";
import { SAME_MEASURE, UNITS } from "@/lib/ingredient-line";
import type { RawExtract } from "@/lib/recipe-extract";
import { ingredientLines, shoppingText } from "@/lib/recipes";
import { pantryKey } from "@/lib/pantry";
import { UNIT_WORDS } from "@/lib/recipes";

/**
 * The reading itself is a model's job and is not tested here — there is no key in this
 * suite and a test that needed one would be a test of somebody else's uptime. What is
 * tested is the part either side of it that has to be exactly right: the shape of the lines
 * it writes, and the units it is allowed to write them in.
 *
 * Both matter for the same reason. An ingredient line is not free text in this app. The
 * recipe page splits it with `ingredientLines`, `writeRecipesToList` turns it into an
 * errand through `shoppingText`, and `pantryKey` matches it against the cupboard. A line
 * written in a shape those cannot take apart lands on the shopping list with its unit still
 * attached and never matches anything again — and nothing fails, which is the whole
 * problem. So the round trip is asserted directly rather than assumed.
 */

const RAW: RawExtract = {
  kind: "reel",
  sourceUrl: "https://www.instagram.com/reel/ABC123/",
  rawTitle: "somekitchen on Instagram",
  rawContent: "…",
  imageUrl: null,
  timeHintMinutes: null,
};

function normalized(overrides: Partial<NormalizedRecipe> = {}): NormalizedRecipe {
  return {
    isRecipe: true,
    title: "Pasta al limone",
    totalTimeMinutes: null,
    ingredients: [],
    instructions: [],
    needsReview: false,
    reviewReason: null,
    ...overrides,
  };
}

function ingredient(overrides: Partial<NormalizedRecipe["ingredients"][number]>) {
  return {
    name: "spaghetti",
    amount: null,
    unit: null,
    group: null,
    ...overrides,
  };
}

/**
 * The guard that keeps the cupboard working.
 *
 * `shoppingText` strips a leading amount and then a unit word **it recognises**; a unit it
 * has never heard of is left in place and becomes part of the thing being bought. So the
 * model is only ever offered units that are already in `UNIT_WORDS`, and this is what stops
 * the two lists drifting apart — the same arrangement `tests/unit/storage.test.ts` has for a
 * kind's name in TypeScript and its colour in the stylesheet.
 */
describe("the units a recipe may be written in", () => {
  it.each(UNITS)("%s is a unit shoppingText already strips", (unit) => {
    expect(UNIT_WORDS.has(unit)).toBe(true);
    expect(shoppingText(`2 ${unit} mel`)).toBe("Mel");
  });

  it("is Danish-first, because that is what the household's recipes are written in", () => {
    for (const unit of ["tsk", "spsk", "dl", "fed"]) {
      expect(UNITS).toContain(unit);
    }
  });

  // A counted thing is its number alone ("2 æg"), so the counting word is not offered, and
  // cups, ounces and pounds are converted to metric by the reader rather than written.
  it("offers neither a counting word nor an imperial measure", () => {
    for (const unit of ["stk", "cup", "oz", "lb"]) {
      expect(UNITS).not.toContain(unit);
    }
  });
});

/**
 * The same measure under two names — `tsp`↔`tsk`, `tbsp`↔`spsk` — never a conversion.
 * Every word on either side has to be one `shoppingText` already strips (in `UNIT_WORDS`),
 * for the same reason the offered units do: a mapping to a word the cupboard cannot take
 * apart would be this app's own bug reproducing the one `canonicalUnit` exists to catch.
 */
describe("SAME_MEASURE — the same unit, spelled the household's way", () => {
  it("only ever maps to and from a word shoppingText already strips", () => {
    for (const table of Object.values(SAME_MEASURE)) {
      for (const [from, to] of Object.entries(table)) {
        expect(UNIT_WORDS.has(from)).toBe(true);
        expect(UNIT_WORDS.has(to)).toBe(true);
      }
    }
  });

  // Several English synonyms ("tsp", "teaspoon", "teaspoons") all spell the same
  // measure, so this is not a strict one-to-one inverse — only the short forms round
  // trip exactly, which is the direction `canonicalUnit` actually hands to `localUnit`.
  it("round-trips the short forms both ways", () => {
    for (const short of ["tsp", "tbsp", "clove", "can", "slice", "bunch", "pinch"]) {
      const danish = SAME_MEASURE.DA[short];
      expect(danish).toBeDefined();
      expect(SAME_MEASURE.EN[danish]).toBe(short);
    }
  });

  // SAME_MEASURE only respells. Turning a cup into decilitres or grams depends on what is
  // being measured, which is the reader's question (see `ingredientRules`), never a table's.
  it("never converts a unit with no equivalent measure", () => {
    for (const unit of ["cup", "oz", "lb"]) {
      expect(SAME_MEASURE.DA[unit]).toBeUndefined();
    }
  });
});

/*
 * The schema is handed to the SDK, which converts it and sends it as the output format the
 * model must answer in. Nothing here calls out — this only asks whether the two libraries
 * still agree, which is a question with exactly one other way of being answered: an import
 * throwing in production after somebody upgraded one of them.
 */
describe("the schema the reader must answer in", () => {
  it("is something the SDK will take, so the two libraries cannot drift apart", () => {
    const format = zodOutputFormat(NormalizedRecipeSchema);

    expect(format.type).toBe("json_schema");
    expect(format.schema).toMatchObject({ type: "object" });
  });

  it("tells the model every unit it may use", () => {
    const wire = JSON.stringify(zodOutputFormat(NormalizedRecipeSchema).schema);

    expect(wire).toContain(UNITS.join(", "));
  });

  /*
   * Fragile in a way nothing else would catch. `.describe()` has to come *before* its
   * `.nullish()`: written the other way round the converter hoists the inner type into
   * `$defs` and every description is dropped on the floor — no error, no type complaint,
   * just an answer shaped by nothing but the system prompt. It is the guidance per field
   * that carries the rules now, since the constraints themselves do not travel.
   */
  it("carries the guidance for each field, which is all that travels", () => {
    const wire = JSON.stringify(zodOutputFormat(NormalizedRecipeSchema).schema);

    for (const guidance of [
      "What is bought, and only that",
      "never '1 1/2'",
      "For a range, the higher number",
      "never a guess, and never zero",
      "no step number in front of it",
      "sends the cook to a link for the amounts",
    ]) {
      expect(wire).toContain(guidance);
    }
  });

  /*
   * A canary, not a wish. The SDK converts the schema for the wire and drops what the API's
   * format does not carry, so a `z.enum` arrives as a plain string with its values written
   * into the description — which is why `canonicalUnit` checks the answer on the way back
   * instead of trusting the schema to have prevented it. If this ever starts failing the
   * constraint is being carried after all, and that check could be tightened.
   */
  it("does not constrain the unit on the wire, which is why it is checked on the way back", () => {
    const wire = JSON.stringify(zodOutputFormat(NormalizedRecipeSchema).schema);

    expect(wire).not.toContain('"enum"');
  });
});

/*
 * The failure this whole block exists to stop, and it reached production once.
 *
 * The schema the model receives is a converted one, and the conversion drops what the API's
 * format cannot carry: `.positive()` on a number survives as a line of description and
 * nothing more. So a model answering `totalTimeMinutes: 0` for "the text did not say" sends
 * something the API considered entirely valid — and the SDK, validating the answer against
 * the *original* zod schema on the way back, threw the whole recipe away. What the cook saw
 * was "Couldn't read that recipe just now", on a recipe that was fine, every single time.
 *
 * So every answer below is one the wire schema permits, and every one of them has to
 * survive. A field the reader got wrong may cost that field; it may never cost the recipe.
 */
describe("an answer the wire schema permits", () => {
  function read(answer: Record<string, unknown>) {
    const parsed = zodOutputFormat(NormalizedRecipeSchema).parse(JSON.stringify(answer));
    return renderNormalized(parsed, RAW, "DA");
  }

  const complete = {
    isRecipe: true,
    title: "Boller",
    totalTimeMinutes: null,
    ingredients: [{ name: "mel", amount: 500, unit: "g", group: null }],
    instructions: [{ step: "Ælt det sammen.", component: null }],
    needsReview: false,
    reviewReason: null,
  };

  it.each([
    ["no time, written as zero", { ...complete, totalTimeMinutes: 0 }],
    ["no time, written as null", { ...complete, totalTimeMinutes: null }],
    ["a time with a fraction in it", { ...complete, totalTimeMinutes: 22.5 }],
    ["a negative time", { ...complete, totalTimeMinutes: -1 }],
    ["an unrecognised unit", { ...complete, ingredients: [{ ...complete.ingredients[0], unit: "sticks" }] }],
    ["no ingredients at all", { ...complete, ingredients: [] }],
    ["the nullable fields simply left out", { isRecipe: true, title: "Boller", ingredients: [{ name: "mel" }], instructions: [{ step: "Ælt." }] }],
    ["the arrays and the flags left out", { isRecipe: true, title: "Boller" }],
    ["isRecipe left out", { title: "Boller", ingredients: [{ name: "mel" }], instructions: [{ step: "Ælt." }] }],
  ])("survives %s", (_name, answer) => {
    expect(() => read(answer)).not.toThrow();
  });

  it("reads zero, a fraction and a negative as what they mean about the time", () => {
    expect(read({ ...complete, totalTimeMinutes: 0 }).totalTimeMinutes).toBeNull();
    expect(read({ ...complete, totalTimeMinutes: -1 }).totalTimeMinutes).toBeNull();
    expect(read({ ...complete, totalTimeMinutes: 22.5 }).totalTimeMinutes).toBe(23);
    expect(read({ ...complete, totalTimeMinutes: 25 }).totalTimeMinutes).toBe(25);
  });

  it("keeps the ingredient when it is only the unit that is wrong", () => {
    const { ingredients } = read({
      ...complete,
      ingredients: [{ ...complete.ingredients[0], unit: "sticks" }],
    });

    expect(ingredients).toBe("500 mel");
  });
});

/**
 * A recipe read into a language of its own — the unit swap and the decimal separator,
 * both deterministic and both applied after the model, never inside the prompt. See
 * `src/lib/copy/recipes.md`'s "The prompt owns the prose; renderNormalized owns the
 * unit token" — this is that division of labour, exercised end to end.
 */
describe("renderNormalized — reading into a language", () => {
  function lineIn(
    language: "EN" | "DA",
    overrides: Partial<NormalizedRecipe["ingredients"][number]>,
  ) {
    return renderNormalized(normalized({ ingredients: [ingredient(overrides)] }), RAW, language)
      .ingredients;
  }

  it("spells the unit the way the household's own language does", () => {
    expect(lineIn("DA", { name: "sukker", amount: 2, unit: "tbsp" })).toBe("2 spsk sukker");
    expect(lineIn("EN", { name: "sukker", amount: 2, unit: "spsk" })).toBe("2 tbsp sukker");
  });

  it("leaves a unit with no equivalent measure exactly as it was", () => {
    expect(lineIn("DA", { name: "mel", amount: 1, unit: "cup" })).toBe("1 cup mel");
  });

  it("writes the decimal the household's own language does", () => {
    expect(lineIn("DA", { name: "fløde", amount: 1.4, unit: "dl" })).toBe("1,4 dl fløde");
    expect(lineIn("EN", { name: "cream", amount: 1.4, unit: "dl" })).toBe("1.4 dl cream");
  });
});

describe("renderNormalized — an ingredient line", () => {
  function line(overrides: Partial<NormalizedRecipe["ingredients"][number]>) {
    const rendered = renderNormalized(normalized({ ingredients: [ingredient(overrides)] }), RAW, "DA");
    return rendered.ingredients;
  }

  it("writes the amount, the unit and the name in the order a cook reads them", () => {
    expect(line({ name: "spaghetti", amount: 400, unit: "g" })).toBe("400 g spaghetti");
  });

  it("writes a counted ingredient with no unit at all", () => {
    expect(line({ name: "æg", amount: 2, unit: null })).toBe("2 æg");
  });

  it("writes a counted ingredient with its number alone, even where the reader said stk", () => {
    expect(line({ name: "gulerødder", amount: 3, unit: "stk" })).toBe("3 gulerødder");
    expect(line({ name: "æg", amount: 2, unit: "Stk." })).toBe("2 æg");
  });

  /*
   * `shoppingText` cuts a line at its first comma, so a comma inside a name would cut the
   * product in half on the shopping list; brackets would travel there and match nothing in
   * the pantry. The rules forbid both, and the writer makes the forbidding true.
   */
  it("never writes a comma or a bracket inside a name", () => {
    expect(line({ name: "græsk yoghurt, 10%", amount: 200, unit: "g" })).toBe("200 g græsk yoghurt 10%");
    expect(line({ name: "hakkede tomater (på dåse)", amount: 1, unit: "dåse" })).toBe(
      "1 dåse hakkede tomater på dåse",
    );
  });

  // The whole contract in one line: an amount, a unit and the thing bought. There is no
  // field for anything else, so there is nothing for the writer to put after it.
  it("writes nothing but the amount, the unit and the name", () => {
    expect(line({ name: "salt", amount: null, unit: null })).toBe("salt");
    expect(line({ name: "kartofler", amount: 100, unit: "g" })).toBe("100 g kartofler");
  });

  // "knivspids salt" is a thing called knivspids salt as far as `shoppingText` is
  // concerned: it strips a unit word only where an amount came first.
  it("drops a unit that has no amount in front of it", () => {
    expect(line({ name: "salt", amount: null, unit: "knivspids" })).toBe("salt");
  });

  /*
   * The wire schema cannot hold the model to the list — the SDK's conversion turns an enum
   * into a plain string with the values in its description — so the list is kept here
   * instead, on the way back. An unrecognised unit costs the recipe that one word and
   * nothing else; refusing the whole import over it would be the app being pedantic.
   */
  it("drops a unit shoppingText would not recognise, and keeps the rest of the line", () => {
    expect(line({ name: "salt", amount: 2, unit: "sticks" })).toBe("2 salt");
  });

  it("keeps a unit shoppingText knows even where it was not one of the ones offered", () => {
    expect(UNITS).not.toContain("gram");
    expect(line({ name: "mel", amount: 200, unit: "gram" })).toBe("200 gram mel");
  });

  it("takes a unit however it was capitalised or punctuated", () => {
    expect(line({ name: "mel", amount: 2, unit: " SPSK. " })).toBe("2 spsk mel");
  });

  it("drops an ingredient with no name", () => {
    expect(line({ name: "   ", amount: 2, unit: "dl" })).toBe("");
  });

  it.each([
    [0.5, "½ dl fløde"],
    [1.5, "1½ dl fløde"],
    [0.25, "¼ dl fløde"],
    [0.75, "¾ dl fløde"],
    [1 / 3, "⅓ dl fløde"],
    [2 / 3, "⅔ dl fløde"],
    [2, "2 dl fløde"],
    [1.4, "1,4 dl fløde"],
  ])("writes %s as a cook would", (amount, expected) => {
    expect(line({ name: "fløde", amount, unit: "dl" })).toBe(expected);
  });

  it("leaves out an amount that means nothing, and the unit with it", () => {
    expect(line({ name: "mel", amount: 0, unit: "g" })).toBe("mel");
  });
});

describe("renderNormalized — what reaches the shopping list and the pantry", () => {
  /*
   * The chain this whole format exists to survive, asserted end to end: a rendered line,
   * split the way the recipe page splits it, reduced the way an errand is reduced, and
   * keyed the way the cupboard keys it. Every one of these is a line the old importer
   * could plausibly have written differently.
   */
  it.each([
    [ingredient({ name: "salt", amount: null, unit: null }), "Salt", "salt"],
    [ingredient({ name: "græsk yoghurt 10%", amount: 200, unit: "g" }), "Græsk yoghurt 10%", "græsk yoghurt 10%"],
    [ingredient({ name: "hakket oksekød", amount: 500, unit: "g" }), "Hakket oksekød", "hakket oksekød"],
    [ingredient({ name: "fløde", amount: 1.5, unit: "dl" }), "Fløde", "fløde"],
    [ingredient({ name: "hvidløg", amount: 2, unit: "fed" }), "Hvidløg", "hvidløg"],
    [ingredient({ name: "æg", amount: 2, unit: null }), "Æg", "æg"],
    [ingredient({ name: "gulerødder", amount: 3, unit: "stk" }), "Gulerødder", "gulerødder"],
    [ingredient({ name: "olivenolie", amount: 1, unit: "spsk" }), "Olivenolie", "olivenolie"],
  ])("$name becomes one errand and one pantry key", (item, errand, key) => {
    const { ingredients } = renderNormalized(normalized({ ingredients: [item] }), RAW, "DA");
    const [only] = ingredientLines(ingredients);

    expect(shoppingText(only)).toBe(errand);
    expect(pantryKey(only)).toBe(key);
  });

  it("writes one line per ingredient, which is how everything downstream reads them", () => {
    const { ingredients } = renderNormalized(
      normalized({
        ingredients: [
          ingredient({ name: "spaghetti", amount: 400, unit: "g" }),
          ingredient({ name: "citroner", amount: 2, unit: null }),
          ingredient({ name: "fløde", amount: 1, unit: "dl" }),
        ],
      }),
      RAW,
      "DA",
    );

    expect(ingredientLines(ingredients)).toEqual(["400 g spaghetti", "2 citroner", "1 dl fløde"]);
  });

  /*
   * A component heading would read perfectly well on the recipe page and would also go onto
   * the shopping list as an errand, because `writeRecipesToList` walks every line. So the
   * group stays in the model's reasoning — which is what stops the dough's butter being
   * merged with the filling's — and never reaches the page.
   */
  it("never writes a component as a heading line of its own", () => {
    const { ingredients } = renderNormalized(
      normalized({
        ingredients: [
          ingredient({ name: "smør", amount: 100, unit: "g", group: "Dej" }),
          ingredient({ name: "smør", amount: 50, unit: "g", group: "Fyld" }),
        ],
      }),
      RAW,
      "DA",
    );

    expect(ingredientLines(ingredients)).toEqual(["100 g smør", "50 g smør"]);
  });
});

describe("renderNormalized — the rest of the recipe", () => {
  it("writes one step to a line, with no numbering of its own", () => {
    const { instructions } = renderNormalized(
      normalized({
        instructions: [
          { step: "Kog pastaen.", component: null },
          { step: "Riv citronskallen i.", component: null },
        ],
      }),
      RAW,
      "DA",
    );

    expect(instructions).toBe("Kog pastaen.\nRiv citronskallen i.");
  });

  it("names the component a step belongs to, since the ingredients cannot", () => {
    const { instructions } = renderNormalized(
      normalized({ instructions: [{ step: "Rør det hele sammen.", component: "Dressing" }] }),
      RAW,
      "DA",
    );

    expect(instructions).toBe("Dressing: Rør det hele sammen.");
  });

  it("falls back to whatever the page called itself when the reader found no title", () => {
    expect(renderNormalized(normalized({ title: "  " }), RAW, "DA").title).toBe("somekitchen on Instagram");
  });

  // A site publishing `PT1H30M` is stating the answer outright; a number read back out of
  // prose is an inference, however good.
  it("prefers the page's own machine-readable time over the reader's", () => {
    const raw = { ...RAW, timeHintMinutes: 90 };
    expect(renderNormalized(normalized({ totalTimeMinutes: 25 }), raw, "DA").totalTimeMinutes).toBe(90);
  });

  it("takes the reader's time where the page published none", () => {
    expect(renderNormalized(normalized({ totalTimeMinutes: 25 }), RAW, "DA").totalTimeMinutes).toBe(25);
  });

  it("carries a reason to check the recipe over, and nothing when there is none", () => {
    expect(
      renderNormalized(
        normalized({ needsReview: true, reviewReason: "Opskriften mangler mængder til fyldet." }),
        RAW,
        "DA",
      ).note,
    ).toBe("Opskriften mangler mængder til fyldet.");

    expect(renderNormalized(normalized({ needsReview: false, reviewReason: "ignored" }), RAW, "DA").note).toBeNull();
  });
});
