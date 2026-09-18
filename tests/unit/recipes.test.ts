import { describe, expect, it } from "vitest";
import { shoppingText } from "@/lib/recipes";

describe("shoppingText", () => {
  it("drops a leading amount and unit", () => {
    expect(shoppingText("2 løg, finthakket")).toBe("løg, finthakket");
    expect(shoppingText("3 tsk mediumstærk karry")).toBe("mediumstærk karry");
    expect(shoppingText("400 ml kokosmælk")).toBe("kokosmælk");
    expect(shoppingText("4 fed hvidløg, fintrevet")).toBe("hvidløg, fintrevet");
    expect(shoppingText("1 håndfuld frisk koriander, finthakket")).toBe(
      "frisk koriander, finthakket",
    );
  });

  it("treats a unicode fraction as an amount", () => {
    expect(shoppingText("½ tsk chiliflager")).toBe("chiliflager");
  });

  it("drops a bare leading amount with no unit word after it", () => {
    expect(shoppingText("2 eggs")).toBe("eggs");
  });

  it("leaves a line with no leading amount exactly as written", () => {
    expect(shoppingText("salt og friskkværnet peber")).toBe("salt og friskkværnet peber");
  });

  it("leaves a word it does not recognise as a unit in place", () => {
    expect(shoppingText("2 sultne gæster")).toBe("sultne gæster");
  });

  it("is why two amounts of the same ingredient match", () => {
    expect(shoppingText("1 dl mælk")).toBe(shoppingText("5 dl mælk"));
  });
});
