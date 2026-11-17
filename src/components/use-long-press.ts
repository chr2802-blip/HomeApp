"use client";

import { useRef, type PointerEvent, type MouseEvent } from "react";

/** How long a finger rests on something before it counts as pressing and holding. */
export const LONG_PRESS_MS = 450;

/** How far it may drift meanwhile — further is a scroll, not a hold. */
const SLOP_PX = 10;

/**
 * Press and hold, for the one place a card does two things: a tap opens it, a hold
 * starts choosing (the recipe list). Spread the handlers onto the element the finger is
 * on.
 *
 * The click that follows a hold is swallowed in the capture phase, so a link held to
 * choose it is not then followed; and the browser's own long-press menu (a link's
 * "open in new tab" callout) is refused, because the hold already means something here.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }

  return {
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove(event: PointerEvent) {
      const from = start.current;
      if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture(event: MouseEvent) {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu(event: MouseEvent) {
      event.preventDefault();
    },
  };
}
