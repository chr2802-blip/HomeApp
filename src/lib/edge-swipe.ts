/**
 * Swiping in from the left edge to go back, in the installed app — which on an iPhone has
 * no back swipe of its own. The rules are here; `useEdgeSwipe` (in `back-button.tsx`)
 * moves the page with the finger.
 *
 * A touch counts only when it starts at the very edge, so the meal plan's week and the
 * section pages, which are swiped sideways too, keep their own swipe.
 */

/** How close to the left edge a touch must start, in CSS pixels. */
export const EDGE_PX = 24;
/** How far a finger moves before it is read as going one way or the other. */
export const INTENT_PX = 8;
/** The share of the screen's width past which letting go goes back. */
export const BACK_SHARE = 1 / 3;
/** Faster than this to the right (px per ms) goes back, however short the swipe. */
export const FLICK_SPEED = 0.5;
/** A flick must still have moved this far, so a twitch is not a flick. */
const FLICK_MIN_PX = 40;

export function startsAtEdge(x: number) {
  return x >= 0 && x <= EDGE_PX;
}

/**
 * What a finger that has moved (dx, dy) from where it started is doing: not yet known,
 * swiping back (sideways, to the right), or something else (scrolling, or to the left).
 */
export function swipeIntent(dx: number, dy: number): "undecided" | "back" | "other" {
  if (Math.abs(dx) < INTENT_PX && Math.abs(dy) < INTENT_PX) return "undecided";
  return dx > 0 && Math.abs(dx) > Math.abs(dy) ? "back" : "other";
}

/** How far the page follows the finger: never left of where it was. */
export function followFinger(dx: number) {
  return Math.max(0, dx);
}

/** Whether letting go after `dx` pixels, moving at `speed` px/ms, goes back. */
export function letsGoBack(dx: number, width: number, speed: number) {
  if (dx >= width * BACK_SHARE) return true;
  return dx >= FLICK_MIN_PX && speed >= FLICK_SPEED;
}

/** Whether the page is running as the installed app, where nothing else offers a back swipe. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * A finger moving sideways anywhere on a section's page (Recipes | Plan) steps to the page
 * beside it. Unlike the edge swipe it goes either way, so the question is only whether it
 * is sideways at all, and which way.
 */
export function sidewaysIntent(dx: number, dy: number): "undecided" | "left" | "right" | "other" {
  if (Math.abs(dx) < INTENT_PX && Math.abs(dy) < INTENT_PX) return "undecided";
  if (Math.abs(dx) <= Math.abs(dy) * 1.2) return "other";
  return dx > 0 ? "right" : "left";
}
