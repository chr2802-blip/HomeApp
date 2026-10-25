import { describe, expect, it } from "vitest";

import { renderIngredient, scaleIngredient } from "@/lib/ingredient-line";
import { pantryUses, portionsFor, readTimes, stepTimes, timesLabel } from "@/lib/recipes";

/**
 * Cooking a recipe for more or fewer people than it was written for.
 *
 * Only the leading amount of a stored line moves, and it is written back the way
 * `renderIngredient` writes one — a fraction a cook would write, the household's own
 * decimal separator — so a scaled line is still a line `shoppingText` can take apart.
 */
describe("scaleIngredient", () => {
  it("scales the amount and leaves the unit and the thing bought alone", () => {
    expect(scaleIngredient("400 g pasta", 1.5, "DA")).toBe("600 g pasta");
    expect(scaleIngredient("2 dl fløde", 0.5, "DA")).toBe("1 dl fløde");
    expect(scaleIngredient("2 æg", 2, "EN")).toBe("4 æg");
  });

  it("writes what a cook would: fractions, and whole grams rather than decimals", () => {
    expect(scaleIngredient("3 æg", 0.5, "DA")).toBe("1½ æg");
    expect(scaleIngredient("1 tsk salt", 1 / 3, "DA")).toBe("⅓ tsk salt");
    expect(scaleIngredient("400 g kartofler", 3 / 4, "DA")).toBe("300 g kartofler");
    expect(scaleIngredient("500 g hakket oksekød", 1 / 3, "DA")).toBe("167 g hakket oksekød");
    expect(scaleIngredient("1 dl mælk", 1.4, "DA")).toBe("1,4 dl mælk");
    expect(scaleIngredient("1 dl milk", 1.4, "EN")).toBe("1.4 dl milk");
  });

  it("reads every amount a stored line may start with", () => {
    expect(scaleIngredient("1½ dl mælk", 2, "DA")).toBe("3 dl mælk");
    expect(scaleIngredient("½ løg", 2, "DA")).toBe("1 løg");
    expect(scaleIngredient("1,5 kg mel", 2, "DA")).toBe("3 kg mel");
    expect(scaleIngredient("1.5 kg flour", 2, "EN")).toBe("3 kg flour");
    expect(scaleIngredient("1 1/2 cups flour", 2, "EN")).toBe("3 cups flour");
    expect(scaleIngredient("3/4 dl olie", 2, "DA")).toBe("1½ dl olie");
    expect(scaleIngredient("2-3 fed hvidløg", 2, "DA")).toBe("4-6 fed hvidløg");
  });

  it("leaves a line with no amount as it is", () => {
    expect(scaleIngredient("Salt", 3, "DA")).toBe("Salt");
    expect(scaleIngredient("friskkværnet peber", 0.5, "DA")).toBe("friskkværnet peber");
    // A number that is part of the product is not an amount.
    expect(scaleIngredient("græsk yoghurt 10%", 2, "DA")).toBe("græsk yoghurt 10%");
  });

  it("does not touch a line at the portions it was written for", () => {
    expect(scaleIngredient("1,50 dl mælk", 1, "DA")).toBe("1,50 dl mælk");
  });

  it("round-trips a line renderIngredient wrote", () => {
    const line = renderIngredient({ name: "smør", amount: 1.5, unit: "spsk" }, "DA");
    expect(scaleIngredient(scaleIngredient(line, 2, "DA"), 0.5, "DA")).toBe(line);
  });
});

describe("the multiplier", () => {
  it("is what the address asks where that is a choice offered, and the recipe as written otherwise", () => {
    expect(readTimes(undefined)).toBe(1);
    expect(readTimes("2")).toBe(2);
    expect(readTimes("0.5")).toBe(0.5);
    expect(readTimes(["3", "8"])).toBe(3);
    for (const nonsense of ["0", "-2", "2.5", "7", "abc", "", "99"]) expect(readTimes(nonsense)).toBe(1);
  });

  it("steps through the choices and stops at either end", () => {
    expect(stepTimes(1, -1)).toBe(0.5);
    expect(stepTimes(0.5, -1)).toBe(0.5);
    expect(stepTimes(1, 1)).toBe(2);
    expect(stepTimes(10, 1)).toBe(10);
  });

  it("is written ½× and 2×, and half a time is still a use of the pantry", () => {
    expect(timesLabel(0.5)).toBe("½×");
    expect(timesLabel(2)).toBe("2×");
    expect(pantryUses(0.5)).toBe(1);
    expect(pantryUses(3)).toBe(3);
  });

  it("says the people it feeds only where the recipe knows", () => {
    expect(portionsFor(4, 2)).toBe(8);
    expect(portionsFor(3, 0.5)).toBe(2);
    expect(portionsFor(null, 2)).toBeNull();
  });
});
