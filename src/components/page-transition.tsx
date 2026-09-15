"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Which way the page that has just arrived should come in from.
 *
 * Worked out from the two paths rather than from the link that was pressed, so it is
 * the same whether a recipe was opened from its card, from a bookmark or from the back
 * arrow — which walks a segment up the URL rather than through history, for the same
 * reason.
 */
function directionOf(from: string, to: string) {
  if (from === to) return "animate-page-in";
  // Going into something the page was already showing: a list's items, a recipe.
  if (to.startsWith(`${from}/`)) return "animate-page-forward";
  // And back out of it again.
  if (from.startsWith(`${to}/`)) return "animate-page-back";
  // Neither contains the other, so this is a move between tabs: sideways to both, and
  // shown as such rather than pretending one of them is inside the other.
  return "animate-page-switch";
}

/**
 * Re-keyed on every route change so the enter animation replays, and told which
 * animation to play by where the reader came from.
 *
 * The previous path is kept in state and updated during the render that notices the
 * change: a ref would have to be written during render too, which React is entitled to
 * throw away and repeat, and an effect would run after the animation had already
 * started with the wrong class.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [trail, setTrail] = useState({ from: pathname, to: pathname });

  if (trail.to !== pathname) setTrail({ from: trail.to, to: pathname });

  return (
    <div key={pathname} className={directionOf(trail.from, pathname)}>
      {children}
    </div>
  );
}
