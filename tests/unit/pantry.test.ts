import { describe, expect, it } from "vitest";
import { pantryKey, pantryNote, stripStocked } from "@/lib/pantry";
import { shoppingText } from "@/lib/recipes";

/**
 * The pantry's three decisions, none of which needs a database: what an entry is matched
 * by, what a recipe is left asking for once the cupboard has answered, and what the
 * household is told was left out.
 *
 * The first is the one worth guarding hardest. An entry that looks right on the page and
 * silently fails to match "2 tsk salt" is a feature that reads as broken luck rather
 * than as a bug, and the only way it can happen is this key parting company with the one
 * the shopping list itself dedupes by.
 */
describe("pantryKey", () => {
  it("is the shopping list's own wording, lower-cased", () => {
    // Not a reimplementation of `shoppingText` here on purpose: the assertion is that
    // the two agree, so the day one of them learns a new unit the other still matches.
    for (const line of ["Salt", "2 tsk salt", "1 dl olivenolie", "gulerødder, groftrevet"]) {
      expect(pantryKey(line)).toBe(shoppingText(line).toLowerCase());
    }
  });

  it("does not care how it was capitalised or how much of it there is", () => {
    expect(pantryKey("SALT")).toBe(pantryKey("salt"));
    expect(pantryKey("  Salt  ")).toBe(pantryKey("salt"));
    expect(pantryKey("2 tsk salt")).toBe(pantryKey("Salt"));
  });

  it("can come out empty, which is what the action refuses", () => {
    // `shoppingText` takes what follows a comma to be how something is prepared, so a
    // name that is nothing but punctuation leaves nothing behind. Refused rather than
    // stored: an entry with no key matches no ingredient line ever written, and would
    // then claim to be a duplicate of the next one like it.
    expect(pantryKey(",")).toBe("");
  });
});

describe("stripStocked", () => {
  const wanted = new Map([
    ["salt", "Salt"],
    ["hakket oksekød", "Hakket oksekød"],
    ["olivenolie", "Olivenolie"],
  ]);

  it("keeps what has to be bought and names what the cupboard answered for", () => {
    const { keep, covered } = stripStocked(wanted, new Set(["salt", "olivenolie"]));

    expect([...keep.values()]).toEqual(["Hakket oksekød"]);
    expect(covered).toEqual(["Salt", "Olivenolie"]);
  });

  it("leaves a recipe alone where the pantry is empty", () => {
    const { keep, covered } = stripStocked(wanted, new Set());

    expect([...keep.keys()]).toEqual([...wanted.keys()]);
    expect(covered).toEqual([]);
  });

  it("can answer for the whole of a recipe", () => {
    const { keep, covered } = stripStocked(wanted, new Set(wanted.keys()));

    expect(keep.size).toBe(0);
    expect(covered).toHaveLength(3);
  });
});

describe("pantryNote", () => {
  it("says nothing where the pantry did nothing", () => {
    expect(pantryNote([])).toBeUndefined();
  });

  it("names what it covered", () => {
    expect(pantryNote(["Salt"])).toBe("Salt already in the pantry.");
    expect(pantryNote(["Salt", "Peber"])).toBe("Salt and Peber already in the pantry.");
    expect(pantryNote(["Salt", "Peber", "Olie"])).toBe(
      "Salt, Peber and Olie already in the pantry.",
    );
  });

  // Past three it stops being a sentence anybody reads to the end, and the point of
  // naming them — so a cook can say "actually we're out of oil" — is already made.
  it("counts the rest once there are more names than anyone reads", () => {
    expect(pantryNote(["Salt", "Peber", "Olie", "Smør", "Mel"])).toBe(
      "Salt, Peber, Olie and 2 more already in the pantry.",
    );
  });
});
