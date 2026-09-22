import type { HomeLanguage } from "@prisma/client";

/**
 * One thing to say, in every language this app has.
 *
 * `Record<HomeLanguage, string>`, exactly as `THEME_LABELS` is a
 * `Record<HomeTheme, string>`: adding a language to the schema fails to compile against
 * every phrase in the app until each one has a form for it. There is no English
 * catalogue with a Danish file beside it, because that is an English master and a
 * Danish copy — and the copy is the one that quietly falls behind, in a file no
 * reviewer of the English change ever opens. Written as one literal, the two halves
 * cannot be added in separate commits and cannot be reviewed apart.
 */
export type Phrase = Record<HomeLanguage, string>;

/**
 * A thing to say about a number of something, in the two forms both these languages
 * have.
 *
 * English and Danish divide at one and nowhere else, so two forms is the whole of it —
 * no plural-rule table, no CLDR, no parser. What is *not* shared is that a Danish
 * plural is not an English one with an "s" on it: dag/dage, opgave/opgaver, ting/ting.
 * That is why both forms are written out rather than assembled from a stem.
 */
export type Plural = Record<HomeLanguage, { one: string; other: string }>;

/** The names in `{braces}` a phrase leaves to be filled in. */
type Slots<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Slots<Rest>
  : never;

/**
 * Read from the English half, which is enough to compute the shape: a real catalogue
 * entry is written as one literal with both languages inside it, so English and
 * Danish already have to agree on their keys to type-check as a `Phrase` or a
 * `Plural` at all. Whether their *slots* agree — a Danish half that dropped a `{name}`
 * the English half has — is not something this type sees, and is caught instead by
 * `tests/unit/language.test.ts`, which walks the catalogue and holds the two sides
 * equal at every phrase.
 *
 * A `Plural` always needs `"count"`, whether or not either form writes `{count}` in
 * its own text — it is what chooses which form is said, not only a value inside it.
 */
type FormOf<P extends Phrase | Plural> = P["EN"];

type SlotsIn<P extends Phrase | Plural> = FormOf<P> extends { one: string; other: string }
  ? Slots<FormOf<P>["one"] | FormOf<P>["other"]> | "count"
  : Slots<Extract<FormOf<P>, string>>;

export type Fill<P extends Phrase | Plural> = Record<SlotsIn<P>, string | number>;

/**
 * A phrase with slots may not be said without them, and one without may not be given
 * any. An `{n}` nobody filled reads on a phone as the literal characters `{n}` sitting
 * in the middle of a sentence — the one i18n bug that looks like bad data rather than
 * a bug, and the one no test written per screen would catch. Three lines of type
 * instead.
 */
type Args<P extends Phrase | Plural> = [SlotsIn<P>] extends [never] ? [] : [fill: Fill<P>];

export type Say = <P extends Phrase | Plural>(phrase: P, ...fill: Args<P>) => string;

/**
 * Everything this household is told, in the language it reads.
 *
 * Curried the way `homeDb(homeId)` is curried, and for the same reason: the thing
 * being carried is ambient to a whole page and wrong to ask for again per sentence. A
 * page writes `const say = sayIn(user.homeLanguage)` beside its
 * `const db = homeDb(user.homeId)` and stops thinking about it.
 *
 * Deliberately *not* read from the session inside here. The reminder job has no
 * session and must say what it says in each home's own language; `/accept-invite`
 * must say what it says in the *inviting* home's language, which is not the reader's
 * and could not be — the reader has no home yet. An ambient async `t()` can express
 * neither, and would have quietly answered "English" in both.
 */
export function sayIn(language: HomeLanguage): Say {
  // One cast, at the one place the generic meets its implementation.
  return ((phrase: Phrase | Plural, fill?: Record<string, string | number>) => {
    const form = phrase[language];
    const text = typeof form === "string" ? form : Number(fill?.count) === 1 ? form.one : form.other;
    return fill ? fillSlots(text, fill) : text;
  }) as Say;
}

function fillSlots(text: string, fill: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (slot, name: string) => {
    const value = fill[name];
    // A slot with nothing for it is left exactly as it was written, so it reads as
    // the fault it is rather than as the word "undefined" inside a sentence.
    return value === undefined ? slot : String(value);
  });
}
