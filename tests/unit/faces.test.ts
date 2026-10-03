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
    expect(guessEmoji("Afkalke elkedel")).toBe("🫧");
    expect(guessEmoji("Rense afløb")).toBe("🚰");
    expect(guessEmoji("Samle IKEA reol")).toBe("🪛");
    expect(guessEmoji("Støvsuge sofaen")).toBe("🛋️");
    expect(guessEmoji("Rake the leaves in the garden")).toBe("🍂");
  });

  it("keeps the toilet roll apart from the toilet, and the bed linen off the clothes", () => {
    expect(guessEmoji("Toiletpapir")).toBe("🧻");
    expect(guessEmoji("Gøre toilettet rent")).toBe("🚽");
    expect(guessEmoji("Skifte sengetøj")).toBe("🛏️");
    // "kalk" alone would be in "kalkun", and "tap" in "tapet": neither is a chore.
    expect(guessEmoji("Kalkun")).toBeNull();
  });

  it("guesses nothing rather than something wrong", () => {
    expect(guessEmoji("Things")).toBeNull();
    // "vacation" holds "cat" and "have" is Danish for garden: neither is a cat or a plant.
    expect(guessEmoji("I have a question")).toBeNull();
    expect(guessEmoji("Vacation")).toBe("🧳");
  });

  it("only ever guesses a face the picker also offers", () => {
    for (const title of [
      "Groceries", "Hardware", "Jul", "Tandlæge", "Støvsug", "Kaffe", "Aftensmad",
      "Halloween", "Camping", "Fodbold", "Pudse vinduer", "Toiletpapir", "Røgalarm", "Lægen", "Pizzaaften",
      "Moppe", "Skifte pærer i lampen", "Male væggen", "Ny stol", "Hænge billeder op", "Rense tagrender",
      "Stryge skjorter", "Tænde pejsen", "Snerydning", "Tømme postkassen", "Skifte batterier", "Spejl i gangen",
    ]) {
      expect(EMOJI_CHOICES).toContain(guessEmoji(title));
    }
    // The doctor's "lægen" sits inside "tandlægen", so the dentist has to be asked first.
    expect(guessEmoji("Tandlægen")).toBe("🦷");
  });

  it("offers each face once, filling the picker's six rows on a phone and its eight columns wider", () => {
    expect(new Set(EMOJI_CHOICES).size).toBe(EMOJI_CHOICES.length);
    // `EmojiField` draws sixteen columns on a phone (six rows) and eight from `sm` up.
    expect(EMOJI_CHOICES.length).toBe(6 * 16);
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
