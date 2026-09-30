import { describe, expect, it } from "vitest";
import { aisleOf, lookupAisle, SHOP_AISLES } from "@/lib/shop-goods";
import { SHOP_AISLE_LABELS } from "@/lib/copy/lists";

describe("lookupAisle", () => {
  it("knows the everyday goods in either language", () => {
    expect(lookupAisle("Bananer")).toBe("PRODUCE");
    expect(lookupAisle("Chicken breast")).toBe("MEAT_FISH");
    expect(lookupAisle("Piskefløde")).toBe("DAIRY");
    expect(lookupAisle("Opvaskemiddel")).toBe("HOUSEHOLD");
  });

  it("reads the pantry's own goods across from their shelf", () => {
    expect(lookupAisle("Olivenolie")).toBe("SPICES_SAUCES");
    expect(lookupAisle("Hakkede tomater")).toBe("TINS_JARS");
  });

  it("ignores an amount, and finds a good by a run of its own words", () => {
    expect(lookupAisle("2 dl fløde")).toBe("DAIRY");
    expect(lookupAisle("økologiske gulerødder")).toBe("PRODUCE");
  });

  it("takes a frozen good whole rather than as the vegetable in it", () => {
    expect(lookupAisle("Frosne ærter")).toBe("FROZEN");
  });

  it("does not know what it does not know", () => {
    expect(lookupAisle("Gochujang")).toBeNull();
    expect(lookupAisle("")).toBeNull();
  });
});

describe("aisleOf", () => {
  it("prefers what the household said over the built-in list", () => {
    expect(aisleOf("Æg", {})).toBe("DAIRY");
    expect(aisleOf("3 æg", { æg: "BAKERY" })).toBe("BAKERY");
    expect(aisleOf("Gochujang", { gochujang: "SPICES_SAUCES" })).toBe("SPICES_SAUCES");
  });
});

describe("SHOP_AISLES", () => {
  it("is walked produce first and ends on Other", () => {
    expect(SHOP_AISLES[0]).toBe("PRODUCE");
    expect(SHOP_AISLES.at(-1)).toBe("OTHER");
    expect(SHOP_AISLES).toEqual(Object.keys(SHOP_AISLE_LABELS));
  });
});
