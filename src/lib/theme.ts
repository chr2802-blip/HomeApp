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
 * The band across the top of the screen, as an opaque colour the browser can be handed.
 *
 * The one place a colour is written down outside globals.css, because it is the one
 * place CSS cannot reach: `<meta name="theme-color">` colours the phone's own status bar
 * and the chrome of an installed app, and a meta tag takes a literal and not a variable.
 * Without it the bar above the header stays the colour it was while the header below it
 * changes, which is a seam exactly where the home's colour is supposed to be saying
 * which household this is.
 *
 * Each of these is the opaque form of that theme's `--accent-soft`, which is what the
 * header is painted in — so the bar continues the band rather than sitting next to
 * something nearly like it. `tests/unit/theme.test.ts` reads both out of the stylesheet
 * and fails if they ever stop agreeing, which is what keeps this a copy that cannot
 * drift rather than a second opinion.
 */
export const THEME_BAR: Record<HomeTheme, string> = {
  SLATE: "#ffffff",
  OCEAN: "#f0f9ff",
  INDIGO: "#eef2ff",
  VIOLET: "#f5f3ff",
  PLUM: "#fdf4ff",
  SAND: "#fafaf9",
};

/** The colour a home with no choice of its own wears, and the app's own look. */
export const DEFAULT_THEME: HomeTheme = "SLATE";

/** The field the picker submits under, read by `updateHome`. */
export const THEME_FIELD = "theme";
