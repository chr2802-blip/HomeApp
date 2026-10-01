import { describe, expect, it } from "vitest";
import { EMOJI_CHOICES, EMOJI_FIELD, faceOf, guessEmoji, readEmojiChoice } from "@/lib/emoji";

const form = (value?: string) => {
  const data = new FormData();
  if (value !== undefined) data.append(EMOJI_FIELD, value);
  return data;
};

describe("a list's or a task's face", () => {
  it("guesses from the title in either language", () => {
    expect(guessEmoji("Groceries")).toBe("🛒");
    expect(guessEmoji("Indkøbsliste")).toBe("🛒");
    expect(guessEmoji("Hardware store")).toBe("🔨");
    expect(guessEmoji("Christmas gifts")).toBe("🎄");
    expect(guessEmoji("Vande blomster")).toBe("🌱");
    expect(guessEmoji("Take out the recycling")).toBe("♻️");
  });

  it("guesses nothing rather than something wrong", () => {
    expect(guessEmoji("Things")).toBeNull();
    // "vacation" holds "cat" and "have" is Danish for garden: neither is a cat or a plant.
    expect(guessEmoji("I have a question")).toBeNull();
    expect(guessEmoji("Vacation")).toBe("🧳");
  });

  it("only ever guesses a face the picker also offers", () => {
    for (const title of ["Groceries", "Hardware", "Jul", "Tandlæge", "Støvsug", "Kaffe", "Aftensmad"]) {
      expect(EMOJI_CHOICES).toContain(guessEmoji(title));
    }
  });

  it("prefers the household's own choice, and follows the title when there is none", () => {
    expect(faceOf({ emoji: "🎁", title: "Groceries" })).toBe("🎁");
    expect(faceOf({ emoji: null, title: "Groceries" })).toBe("🛒");
    expect(faceOf({ emoji: null, title: "Hardware" })).toBe("🔨");
  });

  it("reads a form that did not mention it as leaving it alone", () => {
    expect(readEmojiChoice(form())).toBeUndefined();
  });

  it("reads an empty choice as 'pick for me'", () => {
    expect(readEmojiChoice(form(""))).toBeNull();
  });

  it("keeps one of the offered faces, and leaves the face alone for anything else", () => {
    expect(readEmojiChoice(form("🛒"))).toBe("🛒");
    expect(readEmojiChoice(form("a whole paragraph"))).toBeUndefined();
    expect(readEmojiChoice(form("🦖"))).toBeUndefined();
  });
});
