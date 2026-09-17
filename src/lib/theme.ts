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

/** The colour a home with no choice of its own wears, and the app's own look. */
export const DEFAULT_THEME: HomeTheme = "SLATE";

/**
 * Each home's band, as the browser wants it: a literal.
 *
 * The one place a colour is written down outside globals.css, because it is the one
 * place CSS cannot reach — `<meta name="theme-color">` takes a literal and does not take
 * a variable, and the phone's status bar is on the far side of it. Every value here is a
 * copy of a `--band` in the stylesheet, and `tests/unit/theme.test.ts` reads both and
 * fails the moment one is adjusted without the other: a band that has drifted looks
 * entirely correct in a browser and shows up on a phone as a seam a millimetre above the
 * header.
 *
 * `Record<HomeTheme, …>` for the same reason the labels are: a theme added to the schema
 * does not compile until somebody has said what the top of the screen does in it.
 */
export const BANDS: Record<HomeTheme, string> = {
  SLATE: "#ffffff",
  OCEAN: "#f0f9ff",
  INDIGO: "#eef2ff",
  VIOLET: "#f5f3ff",
  PLUM: "#fdf4ff",
  SAND: "#f5f5f4",
};

/**
 * The band of a page belonging to no home — the login page, an invite — and the one the
 * manifest carries.
 *
 * The manifest's is the only painter of the screen's edges that cannot follow the
 * household: an installed app on Android reads `theme_color` once, when it is installed,
 * and it is also the colour of the splash screen shown before the app has said anything
 * at all. So it is the default theme's band, which is what somebody sees before they
 * are in a home.
 */
export const APP_BAND = BANDS[DEFAULT_THEME];

/** The field the picker submits under, read by `updateHome`. */
export const THEME_FIELD = "theme";
