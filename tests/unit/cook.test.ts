import { describe, expect, it } from "vitest";

import { clockLabel, cookSteps, isPrepared } from "@/lib/cook";

/**
 * What action mode will and will not show.
 *
 * The breakdown in `Recipe.cookSteps` points at ingredient lines by their position, which
 * is what keeps it free of any text of its own — and what makes it dangerous if it ever
 * falls out of step with the recipe. A mapping left behind by an edit would put another
 * ingredient under a step, at the hob, with nothing failing anywhere. Every save that
 * changes either block rewrites the column, so in practice this should never happen; these
 * are the assertions that it costs nothing when it does.
 *
 * The rule under all of them: on any disagreement the whole breakdown goes, not the part
 * that looks wrong. There is no way to tell which of its entries still line up.
 */

const RECIPE = {
  ingredients: "400 g pasta\n2 dl fløde\nSalt",
  instructions: "Kog pastaen.\nPisk fløden.\nSmag til.",
};

function withSteps(cook: unknown) {
  return { ...RECIPE, cookSteps: cook };
}

const PREPARED = withSteps({
  v: 1,
  steps: [{ uses: [0, 2], minutes: 10 }, { uses: [1], minutes: null }, { uses: [2], minutes: null }],
});

describe("a prepared recipe", () => {
  it("puts the recipe's own ingredient lines under each step, verbatim", () => {
    const steps = cookSteps(PREPARED);

    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({
      text: "Kog pastaen.",
      ingredients: ["400 g pasta", "Salt"],
      minutes: 10,
    });
    expect(steps[1].ingredients).toEqual(["2 dl fløde"]);
  });

  it("is prepared", () => {
    expect(isPrepared(PREPARED)).toBe(true);
  });
});

describe("a recipe with nothing stored", () => {
  /*
   * Everything written before action mode existed, and anything saved while the reader
   * was unavailable. It still cooks — which is the point of the fallback being "no
   * ingredients" rather than "no action mode".
   */
  it("still yields its steps, with nothing under them", () => {
    const steps = cookSteps(withSteps(null));

    expect(steps.map((step) => step.text)).toEqual(["Kog pastaen.", "Pisk fløden.", "Smag til."]);
    expect(steps.every((step) => step.ingredients.length === 0)).toBe(true);
    expect(steps.every((step) => step.minutes === null)).toBe(true);
  });

  it("is not prepared, which is what offers to prepare it", () => {
    expect(isPrepared(withSteps(null))).toBe(false);
    expect(isPrepared(withSteps(undefined))).toBe(false);
  });
});

describe("a breakdown that has fallen out of step", () => {
  /*
   * The guard that matters. A recipe edited from three steps to two leaves a breakdown
   * describing three — and entry two now describes a step that is not there. None of it is
   * used, including the first entry, which may well still be right: there is no way to know
   * which, and a plausible wrong answer at the hob is worse than none.
   */
  it("is ignored whole when it holds a different number of entries", () => {
    const stale = withSteps({ v: 1, steps: [{ uses: [0], minutes: 10 }] });

    expect(cookSteps(stale).every((step) => step.ingredients.length === 0)).toBe(true);
    expect(isPrepared(stale)).toBe(false);
  });

  it("is ignored whole when it is not the shape this app writes", () => {
    for (const nonsense of [{ v: 2, steps: [] }, { steps: "three" }, "[]", 7, []]) {
      expect(isPrepared(withSteps(nonsense))).toBe(false);
    }
  });

  /*
   * An index past the end names an ingredient this recipe does not have. Dropping the one
   * index rather than the whole breakdown is safe in a way dropping a whole entry is not:
   * what is shown is still a subset of the lines that step genuinely referred to.
   */
  it("drops an index that names no ingredient, and keeps the rest", () => {
    const steps = cookSteps(
      withSteps({
        v: 1,
        steps: [{ uses: [0, 9, -1, 1.5], minutes: null }, { uses: [], minutes: null }, { uses: [1], minutes: null }],
      }),
    );

    expect(steps[0].ingredients).toEqual(["400 g pasta"]);
    expect(steps[1].ingredients).toEqual([]);
  });

  it("shows an ingredient once however many times it is named", () => {
    const steps = cookSteps(
      withSteps({
        v: 1,
        steps: [{ uses: [2, 0, 2], minutes: null }, { uses: [], minutes: null }, { uses: [], minutes: null }],
      }),
    );

    expect(steps[0].ingredients).toEqual(["400 g pasta", "Salt"]);
  });
});

describe("a step's timer", () => {
  /*
   * Zero, a negative and a fraction of a minute all mean "the recipe did not say" — the
   * same coercion the importer makes for a recipe's total time, and for the same reason: a
   * number-shaped field in front of a model gets a number in it.
   */
  it.each([
    [0, null],
    [-5, null],
    [0.4, null],
    [9.6, 10],
    [Number.POSITIVE_INFINITY, null],
  ])("reads %s as %s", (stored, expected) => {
    const steps = cookSteps(
      withSteps({
        v: 1,
        steps: [{ uses: [], minutes: stored }, { uses: [], minutes: null }, { uses: [], minutes: null }],
      }),
    );

    expect(steps[0].minutes).toBe(expected);
  });
});

describe("a running timer", () => {
  it("reads as a clock", () => {
    expect(clockLabel(605)).toBe("10:05");
    expect(clockLabel(60)).toBe("1:00");
    expect(clockLabel(9)).toBe("0:09");
  });

  it("never runs past zero", () => {
    expect(clockLabel(-3)).toBe("0:00");
  });
});

describe("a recipe with no instructions at all", () => {
  it("has no steps, and is not asked to be prepared", () => {
    const video = { ingredients: "Salt", instructions: "", cookSteps: null };

    expect(cookSteps(video)).toEqual([]);
    expect(isPrepared(video)).toBe(false);
  });
});
