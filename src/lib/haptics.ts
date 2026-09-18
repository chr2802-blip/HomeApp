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
