/**
 * A short, soft buzz for the moment something is marked done — installed on a phone,
 * this is the one bit of feedback a screen animation can't give: something felt, not
 * just seen. Most browsers have no vibration motor to ask (desktop Safari, Firefox) or
 * silently ignore the call outside a real user gesture; both are fine here, since the
 * screen's own feedback (the tick, the strikethrough) never depended on it.
 */
export function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(15);
  }
}

/**
 * The longer pattern for clearing the last thing off a list — three short buzzes rather
 * than one, which is the difference between "that registered" and "that was the last
 * one". Same caveats as `tick`: a browser with no motor, or one outside a real user
 * gesture, simply does nothing, and the confetti on screen never depended on it.
 */
export function cheer() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([18, 60, 18, 60, 36]);
  }
}
