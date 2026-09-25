import { describe, expect, it } from "vitest";
import { goodsMatching, lookupGood, PANTRY_GOODS } from "@/lib/pantry-goods";
import { isPantryCategory, isPantryUnit, pantryKey } from "@/lib/pantry";
import { readSorted } from "@/lib/pantry-sort";

/**
 * The add box's free half of "where does this go": the list of common basics, and the
 * lookup the add box previews with and `createPantryItem` saves with — one function, so
 * the two cannot disagree.
 */
describe("the common basics", () => {
  it("files every good on a shelf and a unit this app actually offers", () => {
    for (const good of PANTRY_GOODS) {
      expect(isPantryCategory(good.category), good.name.EN).toBe(true);
      if (good.unit) expect(isPantryUnit(good.unit), good.name.EN).toBe(true);
      // A name with no key left would match nothing the household ever typed.
      expect(pantryKey(good.name.EN), good.name.EN).not.toBe("");
      expect(pantryKey(good.name.DA), good.name.DA).not.toBe("");
    }
  });

  it("knows a good by either language's name and by the spellings a household types", () => {
    expect(lookupGood("Spidskommen")?.category).toBe("SPICES");
    expect(lookupGood("cumin")?.category).toBe("SPICES");
    expect(lookupGood("Sort peber")?.name.EN).toBe("Pepper");
    expect(lookupGood("  RIS ")?.unit).toBe("KG");
  });

  it("still knows a good behind a qualifier, a whole word at a time", () => {
    expect(lookupGood("Røget paprika")?.name.EN).toBe("Paprika");
    expect(lookupGood("økologisk hvedemel")?.name.EN).toBe("Flour");
  });

  it("never reaches inside a word — garlic is not an onion", () => {
    expect(lookupGood("Hvidløg")?.name.EN).toBe("Garlic");
    expect(lookupGood("Rødløg")).toBeNull();
  });

  it("does not know what it has never heard of", () => {
    expect(lookupGood("Gochujang")).toBeNull();
    expect(lookupGood("")).toBeNull();
  });

  it("offers suggestions in the household's own language, whichever one was typed", () => {
    expect(goodsMatching("cumi", "DA", 5)).toContain("Spidskommen");
    expect(goodsMatching("spidsk", "EN", 5)).toContain("Cumin");
    // The start of a word before the middle of one.
    expect(goodsMatching("sa", "EN", 2)).toEqual(["Salt", "Soy sauce"]);
    // One letter is every good in the list, which is no suggestion at all.
    expect(goodsMatching("s", "DA", 5)).toEqual([]);
    expect(goodsMatching("a", "EN", 5)).toEqual([]);
  });
});

describe("the model's answer about shelves", () => {
  it("keeps what names a good that was sent and a shelf that exists, and drops the rest alone", () => {
    const sorted = readSorted(
      {
        goods: [
          { index: 0, category: "SAUCES" },
          { index: 1, category: " dry_goods " },
          { index: 2, category: "CELLAR" },
          { index: 7, category: "SPICES" },
          { index: 0, category: "OTHER" },
          { index: 1.5, category: "SPICES" },
        ],
      },
      3,
    );

    expect([...sorted]).toEqual([
      [0, "SAUCES"],
      [1, "DRY_GOODS"],
    ]);
  });
});
