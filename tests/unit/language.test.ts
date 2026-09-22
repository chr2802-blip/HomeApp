/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { DATE_LOCALES, DEFAULT_LANGUAGE, HTML_LANG, LANGUAGE_LABELS, LANGUAGES } from "@/lib/language";

/**
 * The guard on the catalogue `sayIn` reads from.
 *
 * Every phrase in `src/lib/copy/` is written as one literal with both languages inside
 * it, so a missing language fails to compile — the same reason `THEME_LABELS` is a
 * `Record` over the enum rather than a list. What the type system cannot see is
 * *inside* a phrase that does compile: an empty Danish half, a slot the Danish half
 * dropped, or English quietly pasted into the Danish slot to make the whole thing
 * type-check. Those three are this file's whole job.
 *
 * It walks the real files under `src/lib/copy/` rather than a list of its own — an
 * area added and forgotten is in the walk by existing, the same as `home-scoping.test.ts`
 * walks the schema rather than a hand-written list of models.
 */

const modules = import.meta.glob("../../src/lib/copy/*.ts", { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

type PhraseLike = { EN: unknown; DA: unknown };

/** An object whose only keys are the two languages — a `Phrase` or a `Plural` leaf. */
function isPhraseNode(value: unknown): value is PhraseLike {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(",") === "DA,EN"
  );
}

function isPlural(form: unknown): form is { one: string; other: string } {
  return (
    typeof form === "object" &&
    form !== null &&
    typeof (form as Record<string, unknown>).one === "string" &&
    typeof (form as Record<string, unknown>).other === "string"
  );
}

type Found = { path: string; phrase: PhraseLike };

/** Walks a namespace object down to its phrases, naming each one by its own path. */
function collect(value: unknown, path: string, found: Found[]) {
  if (isPhraseNode(value)) {
    found.push({ path, phrase: value });
    return;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collect(child, path ? `${path}.${key}` : key, found);
    }
  }
}

const PHRASES: Found[] = [];
for (const [file, exports] of Object.entries(modules)) {
  if (file.endsWith("/say.ts")) continue; // the machinery, not a catalogue
  for (const [exportName, value] of Object.entries(exports)) {
    collect(value, `${file.replace(/^.*\//, "")}:${exportName}`, PHRASES);
  }
}

/** The `{name}` slots a piece of text leaves to be filled in — mirrors `say.ts`'s own regex. */
function slotsIn(text: string): Set<string> {
  return new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]));
}

const sameSet = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((value) => b.has(value));

describe("the phrase catalogue", () => {
  it("found at least one phrase in every area file", () => {
    expect(PHRASES.length).toBeGreaterThan(50);
  });

  it.each(PHRASES.map(({ path, phrase }) => [path, phrase] as const))(
    "%s says something in every language",
    (_path, phrase) => {
      for (const language of LANGUAGES) {
        const form = phrase[language];
        if (isPlural(form)) {
          expect(form.one.trim().length).toBeGreaterThan(0);
          expect(form.other.trim().length).toBeGreaterThan(0);
        } else {
          expect(typeof form).toBe("string");
          expect((form as string).trim().length).toBeGreaterThan(0);
        }
      }
    },
  );

  it.each(PHRASES.map(({ path, phrase }) => [path, phrase] as const))(
    "%s asks for the same slots in every language",
    (_path, phrase) => {
      const slotsFor = (language: (typeof LANGUAGES)[number]) => {
        const form = phrase[language];
        if (isPlural(form)) {
          return new Set([...slotsIn(form.one), ...slotsIn(form.other)]);
        }
        return slotsIn(form as string);
      };

      const [first, ...rest] = LANGUAGES.map(slotsFor);
      for (const slots of rest) {
        expect(sameSet(slots, first)).toBe(true);
      }
    },
  );

  it.each(PHRASES.map(({ path, phrase }) => [path, phrase] as const))(
    "%s's own two forms agree on their slots where it is a plural",
    (_path, phrase) => {
      for (const language of LANGUAGES) {
        const form = phrase[language];
        if (!isPlural(form)) continue;
        expect(sameSet(slotsIn(form.one), slotsIn(form.other))).toBe(true);
      }
    },
  );

  /**
   * The signature of English pasted into the Danish slot to make the whole thing
   * compile — indistinguishable from finished work by the type system, which only
   * asks that *a* string is there. Single words are exempt: "OK", "Email" and "Pasta"
   * are the same word in both languages, and forcing an escape hatch for them would be
   * exactly the kind of list that drifts. This is the one judgement call in this file,
   * and it loosens by being deleted, not by growing an allow-list.
   */
  it.each(
    PHRASES.filter(({ phrase }) => {
      const en = isPlural(phrase.EN) ? phrase.EN.other : (phrase.EN as string);
      return en.trim().includes(" ");
    }).map(({ path, phrase }) => [path, phrase] as const),
  )("%s is not identical between English and Danish", (_path, phrase) => {
    const en = isPlural(phrase.EN) ? phrase.EN.other : (phrase.EN as string);
    const da = isPlural(phrase.DA) ? phrase.DA.other : (phrase.DA as string);
    expect(da).not.toBe(en);
  });
});

describe("the language itself", () => {
  it.each(LANGUAGES)("%s is named for itself, has an <html lang> and a date-fns locale", (language) => {
    expect(LANGUAGE_LABELS[language].length).toBeGreaterThan(0);
    expect(HTML_LANG[language].length).toBeGreaterThan(0);
    expect(DATE_LOCALES[language]).toBeDefined();
  });

  it("defaults to English, which is the voice the app has always had", () => {
    expect(DEFAULT_LANGUAGE).toBe("EN");
  });
});
