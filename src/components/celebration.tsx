"use client";

import { useEffect } from "react";

/**
 * The burst for clearing the last thing off a list.
 *
 * Confetti rather than another message, because the page already says it in words
 * ("Nice — everything here is ticked off") and a second sentence would only be the same
 * sentence. This is the moment, not the record of it: it plays once, over the whole
 * screen, and takes itself off the page afterwards.
 *
 * Fixed and over everything, because the last row is ticked wherever the list happens
 * to be scrolled to — a burst anchored to the rows could easily play off screen, which
 * is a celebration nobody attends. `pointer-events-none` throughout: the thing under it
 * stays pressable while it falls, so a mis-tick can be undone immediately.
 *
 * Hidden from screen readers outright. There is nothing here to read: what happened is
 * in the heading below it, which says how many are now completed, and in the line that
 * replaces the open rows.
 */

/** Only the palette that means nothing in particular — see `globals.css`. */
const COLOURS = ["var(--chart-lists)", "var(--chart-recipes)", "var(--chart-tasks)"];

/**
 * Written out rather than generated, so every household gets the same burst and there
 * is no randomness to reason about between the server and the browser. Sixteen pieces:
 * enough to read as a burst on a phone, few enough that they are gone in a moment.
 *
 * `left` is where a piece starts across the screen, `x` how far it drifts on the way
 * down, and the durations vary so they do not fall as a curtain.
 */
const PIECES = [
  { left: 12, x: -34, rotate: 420, duration: 1500, delay: 60 },
  { left: 20, x: 52, rotate: -300, duration: 1250, delay: 0 },
  { left: 28, x: -18, rotate: 240, duration: 1650, delay: 120 },
  { left: 34, x: 40, rotate: -480, duration: 1350, delay: 40 },
  { left: 41, x: -60, rotate: 360, duration: 1550, delay: 150 },
  { left: 46, x: 16, rotate: -220, duration: 1200, delay: 90 },
  { left: 50, x: -44, rotate: 540, duration: 1700, delay: 20 },
  { left: 54, x: 62, rotate: -360, duration: 1300, delay: 170 },
  { left: 59, x: -26, rotate: 300, duration: 1600, delay: 70 },
  { left: 65, x: 34, rotate: -420, duration: 1400, delay: 130 },
  { left: 72, x: -50, rotate: 480, duration: 1250, delay: 30 },
  { left: 78, x: 24, rotate: -260, duration: 1650, delay: 110 },
  { left: 84, x: -38, rotate: 340, duration: 1450, delay: 180 },
  { left: 90, x: 46, rotate: -500, duration: 1350, delay: 50 },
  { left: 16, x: 28, rotate: 260, duration: 1550, delay: 200 },
  { left: 68, x: -14, rotate: -340, duration: 1500, delay: 220 },
];

/** How long the last piece is still falling, so the overlay knows when it is done. */
const LIFETIME = Math.max(...PIECES.map((piece) => piece.duration + piece.delay)) + 100;

export function Celebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    // Cleared by hand rather than left to the last animation's `animationend`: a piece
    // that never gets to run — a backgrounded tab, reduced motion collapsing every
    // duration to nothing — would leave the overlay on the page for ever.
    const timer = setTimeout(onDone, LIFETIME);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className="animate-confetti absolute -top-4 block h-2.5 w-1.5 rounded-[1px]"
          style={
            {
              left: `${piece.left}%`,
              backgroundColor: COLOURS[index % COLOURS.length],
              animationDuration: `${piece.duration}ms`,
              animationDelay: `${piece.delay}ms`,
              "--confetti-x": `${piece.x}px`,
              "--confetti-rotate": `${piece.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
