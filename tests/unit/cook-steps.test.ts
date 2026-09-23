import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { PreparedStepsSchema, readAnswer } from "@/lib/cook-steps";
import { ingredientLines, instructionLines } from "@/lib/recipes";

/**
 * The reading itself is a model's job and is not tested here — there is no key in this
 * suite and a test that needed one would be a test of somebody else's uptime. What is
 * tested is the part either side of it, which is the part that can be quietly wrong.
 *
 * The same two traps `tests/unit/recipe-normalize.test.ts` holds apply to this schema, and
 * for the same reasons: a constraint that does not reach the model is one the model can
 * innocently break, and a `.describe()` written after its `.nullish()` never travels at
 * all. Both failures are silent. Both have reached production once already.
 */

describe("the schema the model is actually sent", () => {
  const wire = () => JSON.stringify(zodOutputFormat(PreparedStepsSchema).schema);

  /*
   * Fragile in a way nothing else would catch. `.describe()` has to come *before* its
   * `.nullish()`: the other way round the converter hoists the inner type into `$defs` and
   * every description is dropped — no error, no type complaint, just an answer shaped by
   * nothing but the system prompt. `uses` is the one that matters most: without its
   * description the numbers coming back are not anchored to anything.
   */
  it("carries the guidance for each field, which is all that travels", () => {
    for (const guidance of [
      "in the household's language",
      "Zero-based: the first ingredient you return is 0",
      "never a guess",
    ]) {
      expect(wire()).toContain(guidance);
    }
  });

  /*
   * A canary, the same one the importer keeps. The wire format drops what it cannot carry,
   * so nothing here may narrow a value — `readAnswer` coerces instead, where a wrong number
   * costs one chip rather than the whole preparation. If this starts failing, constraints
   * are travelling after all and the schema could be tightened.
   */
  it("constrains nothing, which is why the answer is checked on the way back", () => {
    expect(wire()).not.toContain('"enum"');
    expect(wire()).not.toContain('"minimum"');
    expect(wire()).not.toContain('"exclusiveMinimum"');
  });
});

describe("an answer the wire schema permits", () => {
  /** An answer with `ingredientCount` plain ingredients unless it names its own. */
  function read(answer: Record<string, unknown>, ingredientCount = 3) {
    const ingredients = Array.from({ length: ingredientCount }, (_, index) => ({ name: `ting ${index}` }));
    const parsed = zodOutputFormat(PreparedStepsSchema).parse(JSON.stringify({ ingredients, ...answer }));
    return readAnswer(parsed, "DA");
  }

  it("becomes one step to a line, with one entry each", () => {
    const { instructions, steps } = read({
      steps: [
        { step: "Kog pastaen.", uses: [0], minutes: 10 },
        { step: "Pisk fløden.", uses: [1, 2], minutes: null },
      ],
    });

    expect(instructionLines(instructions)).toEqual(["Kog pastaen.", "Pisk fløden."]);
    expect(steps).toEqual([
      { uses: [0], minutes: 10 },
      { uses: [1, 2], minutes: null },
    ]);
  });

  /*
   * The invariant `lib/cook.ts` checks before it will show any of this: one entry per line
   * of instructions. A step dropped for having no text has to take its entry with it, or
   * every entry after it describes the wrong step.
   */
  it("keeps the lines and the entries the same length whatever is dropped", () => {
    const { instructions, steps } = read({
      steps: [
        { step: "Kog pastaen.", uses: [0], minutes: null },
        { step: "   ", uses: [1], minutes: 5 },
        { step: null, uses: [2], minutes: null },
        { step: "Smag til.", uses: [2], minutes: null },
      ],
    });

    expect(instructionLines(instructions)).toHaveLength(2);
    expect(steps).toHaveLength(2);
    expect(steps[1].uses).toEqual([2]);
  });

  /*
   * A newline inside one step would split it into two lines on the way out, and every
   * entry from there on would be describing the step above the one it belongs to — the
   * exact drift the count guard cannot see, because the count would still match.
   */
  it("never lets one step become two lines", () => {
    const { instructions, steps } = read({
      steps: [{ step: "Kog pastaen.\nHæld vandet fra.", uses: [0], minutes: null }],
    });

    expect(instructionLines(instructions)).toEqual(["Kog pastaen. Hæld vandet fra."]);
    expect(steps).toHaveLength(1);
  });

  it("drops a number that names no ingredient, and keeps the rest", () => {
    const { steps } = read({ steps: [{ step: "Rør.", uses: [0, 7, -2, 1.5, 2], minutes: null }] });

    expect(steps[0].uses).toEqual([0, 2]);
  });

  it("lists an ingredient once however many times it is named", () => {
    const { steps } = read({ steps: [{ step: "Rør.", uses: [2, 0, 2, 0], minutes: null }] });

    expect(steps[0].uses).toEqual([0, 2]);
  });

  it.each([
    ["zero, meaning the recipe did not say", 0, null],
    ["a negative", -10, null],
    ["a fraction of a minute", 0.3, null],
    ["a decimal worth rounding", 14.6, 15],
  ])("reads %s as %s", (_name, minutes, expected) => {
    const { steps } = read({ steps: [{ step: "Bag.", uses: [], minutes }] });

    expect(steps[0].minutes).toBe(expected);
  });

  it("takes a step with nothing said about it at all", () => {
    const { instructions, steps } = read({ steps: [{ step: "Lad dejen hvile." }] });

    expect(instructions).toBe("Lad dejen hvile.");
    expect(steps).toEqual([{ uses: [], minutes: null }]);
  });

  it("takes an answer with no steps in it, rather than throwing the call away", () => {
    expect(read({})).toMatchObject({ instructions: "", steps: [] });
    expect(read({ steps: [] })).toMatchObject({ instructions: "", steps: [] });
  });

  /*
   * A recipe with no ingredients listed — a reel that is all method. Every number the
   * model could send is out of range, and what comes back is steps with nothing under
   * them, which is exactly what the recipe says.
   */
  it("is safe against a recipe that lists no ingredients", () => {
    const { steps } = read({ steps: [{ step: "Kog pastaen.", uses: [0, 1], minutes: null }] }, 0);

    expect(steps[0].uses).toEqual([]);
  });

  /*
   * The save writes the ingredient lines as well as the steps, through the same writer an
   * import uses — so a hand-typed recipe comes out in exactly the shape an imported one does.
   */
  it("writes the ingredients as amount, unit and name, in the household's own spelling", () => {
    const { ingredients } = read({
      ingredients: [
        { name: "kartofler", amount: 100, unit: "g" },
        { name: "æg", amount: 2, unit: "stk" },
        { name: "sukker", amount: 1.5, unit: "tbsp" },
        { name: "salt" },
      ],
      steps: [],
    });

    expect(ingredientLines(ingredients)).toEqual(["100 g kartofler", "2 æg", "1½ spsk sukker", "salt"]);
  });

  /*
   * The model's positions are into its own answer; the stored ones are into the lines
   * actually written. An ingredient dropped for having no name has to move every position
   * after it down by one, or the rest of the recipe sits beside the wrong step at the hob.
   */
  it("renumbers the steps' ingredients past one that was dropped", () => {
    const { ingredients, steps } = read({
      ingredients: [{ name: "mel" }, { name: "  " }, { name: "vand" }, { name: "salt" }],
      steps: [
        { step: "Bland.", uses: [0, 1, 2], minutes: null },
        { step: "Smag til.", uses: [3], minutes: null },
      ],
    });

    expect(ingredientLines(ingredients)).toEqual(["mel", "vand", "salt"]);
    expect(steps).toEqual([
      { uses: [0, 1], minutes: null },
      { uses: [2], minutes: null },
    ]);
  });

  it("carries the title it was given, and nothing where it gave none", () => {
    expect(read({ title: "  Kartoffelsuppe " }).title).toBe("Kartoffelsuppe");
    expect(read({}).title).toBeNull();
  });
});
