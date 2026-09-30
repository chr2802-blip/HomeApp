import { describe, expect, it } from "vitest";
import { cookLines, rankByPantry, PANTRY_COOK_COUNT, type CookCandidate } from "@/lib/pantry-cook";
import { lineInStock } from "@/lib/pantry";

const candidate = (id: string, ingredients: string, staples = new Set<string>()): CookCandidate => ({
  id,
  title: id,
  photoId: null,
  lines: cookLines(ingredients, staples),
});

describe("cookLines", () => {
  it("reduces each line to what is bought, once, and leaves the staples out", () => {
    expect(cookLines("2 dl mælk\n3 æg\nSalt\n1 dl mælk", new Set(["salt"]))).toEqual(["Mælk", "Æg"]);
  });
});

describe("lineInStock", () => {
  it("counts a qualifier dropped to find the entry, which the shopping list only asks about", () => {
    expect(lineInStock("røget paprika", new Set(["paprika"]))).toBe(true);
  });

  it("wants every half of a combined line", () => {
    expect(lineInStock("salt og peber", new Set(["salt"]))).toBe(false);
    expect(lineInStock("salt og peber", new Set(["salt", "peber"]))).toBe(true);
  });

  it("never reaches inside a compound word", () => {
    expect(lineInStock("rødløg", new Set(["løg"]))).toBe(false);
  });
});

describe("rankByPantry", () => {
  const stocked = new Set(["æg", "mælk", "mel"]);

  it("ranks by the share of the recipe the kitchen has, not by how little it misses", () => {
    const ranked = rankByPantry({
      candidates: [
        candidate("Short", "Æg\nBacon"),
        candidate("Long", "Æg\nMælk\nMel\nSukker\nSmør\nFløde\nVanilje"),
        candidate("All", "Æg\nMælk\nMel"),
      ],
      stocked,
    });
    expect(ranked.map((match) => match.recipeId)).toEqual(["All", "Short", "Long"]);
    expect(ranked[0]).toMatchObject({ have: 3, total: 3, missing: [] });
    expect(ranked[1]).toMatchObject({ have: 1, total: 2, missing: ["Bacon"] });
  });

  it("breaks a tie on fewer missing, then the title", () => {
    const ranked = rankByPantry({
      candidates: [
        candidate("B", "Æg\nBacon"),
        candidate("C", "Æg\nMælk\nBacon\nOst"),
        candidate("A", "Æg\nOst"),
      ],
      stocked,
    });
    expect(ranked.map((match) => match.recipeId)).toEqual(["A", "B", "C"]);
  });

  it("offers nothing the kitchen has none of, and nothing at all from an empty kitchen", () => {
    const candidates = [candidate("Fish", "Laks\nDild"), candidate("Eggs", "Æg")];
    expect(rankByPantry({ candidates, stocked }).map((match) => match.recipeId)).toEqual(["Eggs"]);
    expect(rankByPantry({ candidates, stocked: new Set() })).toEqual([]);
  });

  it("stops at five", () => {
    const candidates = Array.from({ length: 8 }, (_, i) => candidate(`R${i}`, "Æg"));
    expect(rankByPantry({ candidates, stocked })).toHaveLength(PANTRY_COOK_COUNT);
  });
});
