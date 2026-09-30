"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * How long a fold takes to open or shut. Has to agree with `fold-open`/`fold-close` in
 * `globals.css`, the way `SETTLE_MS` agrees with `tick-off`: it is a timer rather than an
 * `animationend` listener because the panel has to arrive and leave where the animation
 * never runs — a backgrounded tab, or reduced motion.
 */
export const FOLD_MS = 260;

// A layout effect is what lets a turned-back fold start from where it had got to before
// anything is painted; the server has nothing to paint, and no layout to wait for.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The movement of a panel folding open or shut, for anything that folds a section away.
 *
 * The panel's height is whatever its contents are, so it cannot be eased with a
 * `height` of its own. Instead the wrapper is a one-row grid for the length of the
 * movement, and the keyframes take that row from `0fr` to `1fr` (or back): the browser
 * works out the height, nothing here measures it. Only while moving is the wrapper a
 * grid that clips — once settled it is a plain block again, so a card's shadow or a
 * focus ring inside it is never cut off.
 *
 * `shown` stays true through the closing movement and goes false when it ends: the
 * caller unmounts or hides on it rather than on `open`, which would remove the panel
 * before anybody saw it shut. A fold that starts open or shut does not move.
 *
 * A fold turned back half way — a second press before the first has landed — goes back
 * from where it is rather than leaping to the far end first. Both keyframes use one
 * symmetric easing, so `t` ms into opening is the same height as `FOLD_MS - t` into
 * shutting, and the new movement is simply started that far in (`style`, a negative
 * `animation-delay`). The caller puts `style` beside `className`.
 */
export function useFold(open: boolean): { shown: boolean; className: string; style?: CSSProperties } {
  const [was, setWas] = useState(open);
  const [shown, setShown] = useState(open);
  const [moving, setMoving] = useState<"open" | "close" | null>(null);
  const [ahead, setAhead] = useState(0);
  // When the movement under way started, and how far in it started.
  const flight = useRef<{ at: number; ahead: number } | null>(null);

  if (was !== open) {
    setWas(open);
    setMoving(open ? "open" : "close");
    if (open) setShown(true);
  }

  useBeforePaint(() => {
    if (moving === null) {
      flight.current = null;
      return;
    }
    const now = performance.now();
    const before = flight.current;
    const next = before ? Math.max(0, FOLD_MS - Math.min(FOLD_MS, now - before.at + before.ahead)) : 0;
    flight.current = { at: now, ahead: next };
    setAhead(next);
    const timer = setTimeout(() => {
      setMoving(null);
      if (moving === "close") setShown(false);
    }, FOLD_MS - next);
    return () => clearTimeout(timer);
  }, [moving]);

  if (moving === null) return { shown, className: "" };
  return {
    shown,
    className: `animate-fold-${moving}`,
    style: ahead > 0 ? { animationDelay: `-${ahead}ms` } : undefined,
  };
}
