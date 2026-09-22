import { describe, expect, it } from "vitest";
import { shoppingText, timeLabel } from "@/lib/recipes";

describe("shoppingText", () => {
  it("drops a leading amount and unit", () => {
    expect(shoppingText("3 tsk mediumstærk karry")).toBe("Mediumstærk karry");
    expect(shoppingText("400 ml kokosmælk")).toBe("Kokosmælk");
  });

  it("drops what follows a comma as a preparation note, not part of what to buy", () => {
    expect(shoppingText("2 løg, finthakket")).toBe("Løg");
    expect(shoppingText("4 fed hvidløg, fintrevet")).toBe("Hvidløg");
    expect(shoppingText("1 håndfuld frisk koriander, finthakket")).toBe("Frisk koriander");
  });

  it("capitalises what is left, whatever case the line arrived in", () => {
    expect(shoppingText("200 g røde linser")).toBe("Røde linser");
    expect(shoppingText("milk")).toBe("Milk");
  });

  it("treats a unicode fraction as an amount", () => {
    expect(shoppingText("½ tsk chiliflager")).toBe("Chiliflager");
  });

  it("drops a bare leading amount with no unit word after it", () => {
    expect(shoppingText("2 eggs")).toBe("Eggs");
  });

  it("leaves a line with no leading amount exactly as written, once capitalised", () => {
    expect(shoppingText("salt og friskkværnet peber")).toBe("Salt og friskkværnet peber");
  });

  it("leaves a word it does not recognise as a unit in place", () => {
    expect(shoppingText("2 sultne gæster")).toBe("Sultne gæster");
  });

  it("is why two amounts of the same ingredient match", () => {
    expect(shoppingText("1 dl mælk")).toBe(shoppingText("5 dl mælk"));
  });

  it("is why the same ingredient with a different preparation note still matches", () => {
    expect(shoppingText("250 g gulerødder, groftrevet")).toBe(shoppingText("gulerødder, revet"));
  });
});

describe("timeLabel", () => {
  it("is null for a recipe with no time", () => {
    expect(timeLabel(null, "EN")).toBeNull();
  });

  it("reads under an hour as plain minutes", () => {
    expect(timeLabel(25, "EN")).toBe("25 min");
  });

  it("reads exactly an hour with no minutes left over", () => {
    expect(timeLabel(60, "EN")).toBe("1 hr");
  });

  it("reads a mix of hours and minutes", () => {
    expect(timeLabel(90, "EN")).toBe("1 hr 30 min");
  });

  it("reads in the household's own language", () => {
    expect(timeLabel(25, "DA")).toBe("25 min");
    expect(timeLabel(60, "DA")).toBe("1 t");
    expect(timeLabel(90, "DA")).toBe("1 t 30 min");
  });
});
