import { describe, expect, it } from "vitest";
import { sayIn } from "@/lib/copy/say";
import { PANTRY } from "@/lib/copy/pantry";
import { DUE } from "@/lib/copy/dates";
import { namesInWords, pantryNote } from "@/lib/pantry";

/**
 * `sayIn` itself: a plain phrase, a phrase with a slot, a plural at one and at more
 * than one, and the pantry's own sentence with a conjunction in it — the shapes
 * `tests/unit/language.test.ts` cannot exercise, because that file only reads the
 * catalogue rather than saying anything with it.
 */
describe("sayIn", () => {
  it("says a plain phrase in the language asked for", () => {
    expect(sayIn("EN")(PANTRY.title)).toBe("Pantry");
    expect(sayIn("DA")(PANTRY.title)).toBe("Spisekammer");
  });

  it("fills a phrase's slot", () => {
    expect(sayIn("EN")(PANTRY.duplicate, { name: "Salt" })).toBe("“Salt” is already in the pantry.");
    expect(sayIn("DA")(PANTRY.duplicate, { name: "Salt" })).toBe("“Salt” står allerede i spisekammeret.");
  });

  it("picks the singular form at one and the plural otherwise", () => {
    expect(sayIn("EN")(DUE.overdue, { count: 1 })).toBe("1 day overdue");
    expect(sayIn("EN")(DUE.overdue, { count: 2 })).toBe("2 days overdue");
    expect(sayIn("DA")(DUE.overdue, { count: 1 })).toBe("1 dag over tid");
    expect(sayIn("DA")(DUE.overdue, { count: 2 })).toBe("2 dage over tid");
  });

  it("leaves an unfilled slot exactly as written, rather than as the word undefined", () => {
    expect(sayIn("EN")(PANTRY.duplicate, { name: undefined as unknown as string })).toBe(
      "“{name}” is already in the pantry.",
    );
  });
});

/**
 * The hardest sentence in the app — `namesInWords` and `pantryNote` — held in both
 * languages, including the conjunction, which is never a phrase of its own (see
 * `lastTwo` in `src/lib/copy/pantry.ts`).
 */
describe("namesInWords", () => {
  it.each([
    ["EN", ["Salt"], "Salt"],
    ["EN", ["Salt", "Peber"], "Salt and Peber"],
    ["EN", ["Salt", "Peber", "Olie"], "Salt, Peber and Olie"],
    ["EN", ["Salt", "Peber", "Olie", "Smør", "Mel"], "Salt, Peber, Olie and 2 more"],
    ["DA", ["Salt"], "Salt"],
    ["DA", ["Salt", "Peber"], "Salt og Peber"],
    ["DA", ["Salt", "Peber", "Olie"], "Salt, Peber og Olie"],
    ["DA", ["Salt", "Peber", "Olie", "Smør", "Mel"], "Salt, Peber, Olie og 2 mere"],
  ] as const)("joins %s's names as %o -> %s", (language, names, expected) => {
    expect(namesInWords([...names], language)).toBe(expected);
  });
});

describe("pantryNote", () => {
  it("says nothing where there is nothing to say, in either language", () => {
    expect(pantryNote([], "EN")).toBeUndefined();
    expect(pantryNote([], "DA")).toBeUndefined();
  });

  it("names what the press left alone, in the household's language", () => {
    expect(pantryNote(["Salt", "Olie"], "EN")).toBe("Salt and Olie already in the pantry.");
    expect(pantryNote(["Salt", "Olie"], "DA")).toBe("Salt og Olie står allerede i spisekammeret.");
  });
});
