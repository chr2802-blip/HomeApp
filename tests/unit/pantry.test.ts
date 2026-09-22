import { describe, expect, it } from "vitest";
import {
  alreadyOnListNote,
  ambiguousLines,
  namesInWords,
  pantryKey,
  pantryNote,
  stripStocked,
} from "@/lib/pantry";
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

  // A line naming more than one thing is not a second opinion about what the pantry
  // matches — it is still checked key by key, just against each half of the line rather
  // than the line whole.
  it("answers for a combined line where every part is stocked", () => {
    const combined = new Map([["salt og peber", "Salt og peber"]]);
    const { keep, covered } = stripStocked(combined, new Set(["salt", "peber"]));

    expect(keep.size).toBe(0);
    expect(covered).toEqual(["Salt og peber"]);
  });

  it("leaves a combined line alone where only some of it is stocked and nothing was resolved", () => {
    const combined = new Map([["salt og peber", "Salt og peber"]]);
    const { keep, covered } = stripStocked(combined, new Set(["salt"]));

    // Unresolved, `ambiguousLines` is what is meant to stop this from being asked at
    // all — but on its own the default is to leave it off the list, the same as a
    // covered line, rather than silently re-buy the salt.
    expect(keep.size).toBe(0);
    expect(covered).toEqual(["Salt og peber"]);
  });

  it("keeps a combined line once the household has said to still add it", () => {
    const combined = new Map([["salt og peber", "Salt og peber"]]);
    const { keep, covered } = stripStocked(combined, new Set(["salt"]), new Set(["salt og peber"]));

    expect([...keep.values()]).toEqual(["Salt og peber"]);
    expect(covered).toEqual([]);
  });
});

describe("ambiguousLines", () => {
  it("finds nothing where a combined line is fully stocked or not stocked at all", () => {
    const wanted = new Map([
      ["salt og peber", "Salt og peber"],
      ["mel og sukker", "Mel og sukker"],
    ]);

    expect(ambiguousLines(wanted, new Set(["salt", "peber"]))).toEqual([]);
    expect(ambiguousLines(wanted, new Set())).toEqual([]);
  });

  it("finds a combined line the pantry only partly answers for, and names the part it has", () => {
    const wanted = new Map([["salt og peber", "Salt og peber"]]);

    expect(ambiguousLines(wanted, new Set(["salt"]))).toEqual([
      { key: "salt og peber", text: "Salt og peber", matched: ["Salt"] },
    ]);
  });

  it("leaves a single-item line alone, however normal a word it is", () => {
    expect(ambiguousLines(new Map([["salt", "Salt"]]), new Set(["salt"]))).toEqual([]);
    expect(ambiguousLines(new Map([["salt", "Salt"]]), new Set())).toEqual([]);
  });
});

describe("namesInWords", () => {
  it("joins what there is", () => {
    expect(namesInWords(["Salt"], "EN")).toBe("Salt");
    expect(namesInWords(["Salt", "Peber"], "EN")).toBe("Salt and Peber");
    expect(namesInWords(["Salt", "Peber", "Olie"], "EN")).toBe("Salt, Peber and Olie");
  });

  // Past three it stops being a sentence anybody reads to the end, and the point of
  // naming them — so a cook can say "actually we're out of oil" — is already made.
  it("counts the rest once there are more names than anyone reads", () => {
    expect(namesInWords(["Salt", "Peber", "Olie", "Smør", "Mel"], "EN")).toBe(
      "Salt, Peber, Olie and 2 more",
    );
  });

  it("joins with 'og' rather than 'and' for a Danish home", () => {
    expect(namesInWords(["Salt", "Peber"], "DA")).toBe("Salt og Peber");
    expect(namesInWords(["Salt", "Peber", "Olie"], "DA")).toBe("Salt, Peber og Olie");
    expect(namesInWords(["Salt", "Peber", "Olie", "Smør", "Mel"], "DA")).toBe(
      "Salt, Peber, Olie og 2 mere",
    );
  });
});

describe("the two notes", () => {
  it("say nothing where there is nothing to say", () => {
    expect(pantryNote([], "EN")).toBeUndefined();
    expect(alreadyOnListNote([], "EN")).toBeUndefined();
  });

  it("name what the press left alone, from either end", () => {
    expect(pantryNote(["Salt", "Olie"], "EN")).toBe("Salt and Olie already in the pantry.");
    expect(alreadyOnListNote(["Ris"], "EN")).toBe("Ris already on the list.");
  });

  it("reads in the household's own language", () => {
    expect(pantryNote(["Salt", "Olie"], "DA")).toBe("Salt og Olie står allerede i spisekammeret.");
    expect(alreadyOnListNote(["Ris"], "DA")).toBe("Ris står allerede på listen.");
  });
});
