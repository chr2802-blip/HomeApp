/**
 * The few motion timings JS has to know, because something is unmounted only once its
 * exit animation has played. Each is the same number as a token at the top of
 * globals.css, which a timer cannot read; `tests/unit/motion.test.ts` holds each pair
 * together. Shorter, and the exit is cut off half way; longer, and something invisible
 * sits over the page.
 */

/** A sheet and its backdrop leaving — `--dur-sheet-out`. */
export const SHEET_EXIT_MS = 200;

/** The three-dot menu shrinking back into its button — `--dur-menu-out`. */
export const MENU_EXIT_MS = 120;

/** A snack going back down under the tab bar — `--dur-row`. */
export const SNACK_EXIT_MS = 200;

/** A pager's pages sliding the rest of the way after a swipe or a press — `--dur-base`. */
export const PAGE_TURN_MS = 240;
