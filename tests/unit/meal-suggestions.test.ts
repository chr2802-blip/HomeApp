import { describe, expect, it } from "vitest";
import {
  STAPLE_MINIMUM,
  SUGGESTION_COUNT,
  ingredientKeys,
  rankByOverlap,
  staplesOf,
  suggestionReason,
  type SuggestionCandidate,
} from "@/lib/meal-suggestions";

/** A recipe as the ranking sees it: a name, and lines of shopping. */
function recipe(id: string, ingredients: string[], title = id): SuggestionCandidate {
  return { id, title, ingredients: ingredients.join("\n") };
}

/** Enough recipes for `staplesOf` to have an opinion, none of them sharing anything. */
function padding(count: number): SuggestionCandidate[] {
  return Array.from({ length: count }, (_, index) => recipe(`pad-${index}`, [`Filler ${index}`]));
}

const keysOf = (...lines: string[]) => ingredientKeys(lines.join("\n"));

describe("ingredientKeys", () => {
  it("reads a line the way the shopping list would", () => {
    // The same normalisation `addRecipeIngredients` dedupes a list with: two recipes
    // overlap here exactly where their lines would have landed on one row of the shop.
    expect(keysOf("200 g hakkede tomater")).toEqual(new Set(["hakkede tomater"]));
    expect(keysOf("2 gulerødder, groftrevet")).toEqual(new Set(["gulerødder"]));
  });

  it("counts an ingredient a recipe says twice only once", () => {
    expect(keysOf("1 dl mælk", "5 dl mælk")).toEqual(new Set(["mælk"]));
  });
});

describe("staplesOf", () => {
  it("has no opinion about a home with too few recipes to judge one", () => {
    // Two recipes out of three is 67% of the household's cooking and means nothing at
    // all. Judging anyway would throw away most of what little there was to match on.
    const small = [recipe("a", ["Salt", "Onion"]), recipe("b", ["Salt", "Beef"])];
    expect(staplesOf(small).size).toBe(0);
  });

  it("finds what a home puts in nearly everything", () => {
    const recipes = [
      ...Array.from({ length: STAPLE_MINIMUM }, (_, index) =>
        recipe(`r-${index}`, ["Salt", `Thing ${index}`]),
      ),
    ];
    expect(staplesOf(recipes).has("salt")).toBe(true);
    expect(staplesOf(recipes).has("thing 0")).toBe(false);
  });
});

describe("rankByOverlap", () => {
  const basket = keysOf("Onion", "Tomato", "Beef", "Pasta");

  it("offers nothing at all when the week has nothing to share with", () => {
    // With no basket, "best" could only mean "shortest", which is a ranking of recipes
    // by how little they are — and the recipes page already lists every one of them.
    expect(
      rankByOverlap({ candidates: [recipe("a", ["Onion"])], basket: new Set(), staples: new Set() }),
    ).toEqual([]);
  });

  it("ranks by the share of a recipe that comes free, not by how little it adds", () => {
    // The trap this exists to avoid: fewest-new is won every time by whichever recipe
    // has the shortest list, so a three-line dish sharing nothing would beat a longer
    // one that is almost entirely already in the basket.
    const short = recipe("short", ["Onion", "Saffron", "Cod"]);
    const long = recipe("long", ["Onion", "Tomato", "Beef", "Pasta", "Basil"]);

    const [first] = rankByOverlap({ candidates: [short, long], basket, staples: new Set() });
    expect(first!.recipeId).toBe("long");
    expect(first).toMatchObject({ shared: 4, total: 5 });
  });

  it("leaves out a recipe that shares nothing", () => {
    const stranger = recipe("stranger", ["Saffron", "Cod"]);
    expect(rankByOverlap({ candidates: [stranger], basket, staples: new Set() })).toEqual([]);
  });

  it("does not count a staple as something in common", () => {
    // Salt is in everything, so a recipe whose only overlap is salt has nothing to say.
    const salty = recipe("salty", ["Salt", "Saffron"]);
    const ranked = rankByOverlap({
      candidates: [salty],
      basket: new Set([...basket, "salt"]),
      staples: new Set(["salt"]),
    });
    expect(ranked).toEqual([]);
  });

  it("skips a recipe that is nothing but staples rather than calling it a perfect match", () => {
    // Its score would be a division by zero wearing the look of a full overlap.
    const bare = recipe("bare", ["Salt", "Pepper"]);
    const ranked = rankByOverlap({
      candidates: [bare],
      basket: new Set([...basket, "salt", "pepper"]),
      staples: new Set(["salt", "pepper"]),
    });
    expect(ranked).toEqual([]);
  });

  it("offers the same three in the same order however often it is asked", () => {
    // Nothing random: a suggestion that moved between two renders of the same week is
    // one nobody could take a second look at.
    const candidates = [
      recipe("d", ["Onion", "Tomato", "Cod"]),
      recipe("a", ["Onion", "Tomato", "Cod"]),
      recipe("c", ["Onion", "Beef", "Pasta", "Tomato"]),
      recipe("b", ["Onion", "Saffron", "Cod", "Cream"]),
    ];

    const once = rankByOverlap({ candidates, basket, staples: new Set() });
    const again = rankByOverlap({ candidates: [...candidates].reverse(), basket, staples: new Set() });

    expect(once).toHaveLength(SUGGESTION_COUNT);
    expect(again).toEqual(once);
    // "c" shares 4 of 4; "a" and "d" share 2 of 3 and break their tie on the title.
    expect(once.map((suggestion) => suggestion.recipeId)).toEqual(["c", "a", "d"]);
  });

  it("stops at three, because a longer list is a second recipes page", () => {
    const many = padding(0).concat(
      Array.from({ length: 6 }, (_, index) => recipe(`m-${index}`, ["Onion", `Extra ${index}`])),
    );
    expect(rankByOverlap({ candidates: many, basket, staples: new Set() })).toHaveLength(
      SUGGESTION_COUNT,
    );
  });
});

describe("suggestionReason", () => {
  it("says what is being offered rather than a score out of ten", () => {
    // Something a cook can disagree with by opening the recipe, rather than take on trust.
    expect(suggestionReason({ recipeId: "a", title: "Lasagne", shared: 4, total: 6 }, "EN")).toBe(
      "Shares 4 of 6 ingredients with the week",
    );
  });

  it("says it in the household's language, and divides at one like every other count", () => {
    expect(suggestionReason({ recipeId: "a", title: "Lasagne", shared: 4, total: 6 }, "DA")).toBe(
      "Deler 4 af 6 ingredienser med ugen",
    );
    expect(suggestionReason({ recipeId: "a", title: "Toast", shared: 1, total: 1 }, "EN")).toBe(
      "Shares 1 of 1 ingredient with the week",
    );
  });
});
