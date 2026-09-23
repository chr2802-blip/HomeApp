import type { HomeTheme } from "@prisma/client";
import type { Phrase } from "./copy/say";
import { SETTINGS } from "./copy/settings";

/**
 * What each of a home's colours is called — `SETTINGS.colour.names`, in both languages,
 * held here to a `Record<HomeTheme, …>` so that adding a theme to the schema fails to
 * compile until it has a name.
 *
 * Only the names: what the colours actually are lives in `globals.css`, in a block per
 * theme keyed by these same values, and everything that wears one reads it from there.
 * Writing the hexes here too would be a second answer to the same question, and the two
 * would disagree the first time one of them was adjusted. That a theme also has a colour
 * is checked by `tests/unit/theme.test.ts`, which reads the stylesheet — a theme with no
 * block would otherwise simply render as whichever home was on screen before it.
 */
const THEME_NAMES: Record<HomeTheme, Phrase> = SETTINGS.colour.names;

/**
 * Every theme, in the order they are offered. Derived from the names rather than
 * written out again: an object's string keys come back in the order they were written.
 *
 * Typed as a non-empty tuple because that is what `z.enum` wants from the action that
 * validates the picker's answer.
 */
export const THEMES = Object.keys(THEME_NAMES) as [HomeTheme, ...HomeTheme[]];

/** The colour a home with no choice of its own wears, and the app's own look. */
export const DEFAULT_THEME: HomeTheme = "SLATE";

/**
 * The band, as the browser wants it: a literal.
 *
 * It used to be one colour per theme, a pale tint of that home's accent, on the theory
 * that `<meta name="theme-color">` retints an installed app's status bar on every
 * request. It does not: the strip is set once and does not repaint itself as somebody
 * moves between homes, so a household in more than one saw its own colour up top and
 * whichever other home they had open last underneath it — the seam this file exists to
 * close, worn permanently instead. One band, the same in every theme, is the only value
 * that is never wrong regardless of which home is open, so it is not tied to any of
 * their accents and does not live in `HomeTheme` at all.
 *
 * The one place a colour is written down outside globals.css, because it is the one
 * place CSS cannot reach — the meta tag takes a literal and does not take a variable,
 * and the phone's status bar is on the far side of it. It is a copy of the `--band` in
 * every theme block of the stylesheet, and `tests/unit/theme.test.ts` reads both and
 * fails the moment one is adjusted without the other: a band that has drifted looks
 * entirely correct in a browser and shows up on a phone as a seam a millimetre above the
 * header.
 */
export const BAND = "#e5e7eb";

/** The field the picker submits under, read by `updateHome`. */
export const THEME_FIELD = "theme";
