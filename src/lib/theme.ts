import type { HomeTheme } from "@prisma/client";

/**
 * What each of a home's colours is called.
 *
 * Only the names: what the colours actually are lives in `globals.css`, in a block per
 * theme keyed by these same values, and everything that wears one reads it from there.
 * Writing the hexes here too would be a second answer to the same question, and the two
 * would disagree the first time one of them was adjusted.
 *
 * `Record<HomeTheme, …>` rather than a list, so adding a theme to the schema fails to
 * compile until it has a name here. That it also has a colour is checked by
 * `tests/unit/theme.test.ts`, which reads the stylesheet — a theme with no block would
 * otherwise simply render as whichever home was on screen before it.
 */
export const THEME_LABELS: Record<HomeTheme, string> = {
  SLATE: "Slate",
  OCEAN: "Ocean",
  INDIGO: "Indigo",
  VIOLET: "Violet",
  PLUM: "Plum",
  SAND: "Sand",
};

/**
 * Every theme, in the order they are offered. Derived from the labels rather than
 * written out again: an object's string keys come back in the order they were written.
 *
 * Typed as a non-empty tuple because that is what `z.enum` wants from the action that
 * validates the picker's answer.
 */
export const THEMES = Object.keys(THEME_LABELS) as [HomeTheme, ...HomeTheme[]];

/**
 * The band, as the browser and the manifest want it: a literal.
 *
 * The one place a colour is written down outside globals.css, because it is the one
 * place CSS cannot reach — `<meta name="theme-color">` and `manifest.webmanifest` both
 * take a literal, and neither takes a variable. It is a copy of `--band`, checked
 * against the stylesheet and against the manifest by `tests/unit/theme.test.ts`.
 *
 * One colour rather than one per home, and the reason is Android. An installed app there
 * is a WebAPK whose status bar *and* gesture bar are painted from the manifest's
 * `theme_color`, read once when it is installed — the meta tag is ignored in an app with
 * no chrome to tint. So a phone has exactly one of these, chosen before anybody picked a
 * household colour, and a band that followed the household would be one the phone's own
 * bars contradict. What a home is dressed in is the controls below the band instead.
 */
export const APP_BAND = "#ffffff";

/** The colour a home with no choice of its own wears, and the app's own look. */
export const DEFAULT_THEME: HomeTheme = "SLATE";

/** The field the picker submits under, read by `updateHome`. */
export const THEME_FIELD = "theme";
