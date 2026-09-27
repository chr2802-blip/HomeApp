"use client";

import { useEffect, useState } from "react";

/**
 * How long a fold takes to open or shut. Has to agree with `fold-open`/`fold-close` in
 * `globals.css`, the way `SETTLE_MS` agrees with `tick-off`: it is a timer rather than an
 * `animationend` listener because the panel has to arrive and leave where the animation
 * never runs — a backgrounded tab, or reduced motion.
 */
export const FOLD_MS = 220;

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
 */
export function useFold(open: boolean): { shown: boolean; className: string } {
  const [was, setWas] = useState(open);
  const [shown, setShown] = useState(open);
  const [moving, setMoving] = useState<"open" | "close" | null>(null);

  if (was !== open) {
    setWas(open);
    setMoving(open ? "open" : "close");
    if (open) setShown(true);
  }

  useEffect(() => {
    if (moving === null) return;
    const timer = setTimeout(() => {
      setMoving(null);
      if (moving === "close") setShown(false);
    }, FOLD_MS);
    return () => clearTimeout(timer);
  }, [moving]);

  return { shown, className: moving === null ? "" : `animate-fold-${moving}` };
}
