"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { sectionStep } from "./section-tabs";

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
  // A sideways step between the pages of one section (Recipes | Meals): in from the side
  // the pill moved towards, rather than rising as a change of tab does.
  const step = sectionStep(from, to);
  if (step) return step === 1 ? "animate-page-forward" : "animate-page-back";
  // Going into something the page was already showing: a list's items, a recipe.
  if (to.startsWith(`${from}/`)) return "animate-page-forward";
  // And back out of it again.
  if (from.startsWith(`${to}/`)) return "animate-page-back";
  // Neither contains the other, so this is a move between tabs: sideways to both, and
  // shown as such rather than pretending one of them is inside the other.
  return "animate-page-switch";
}

/**
 * Where each page was scrolled to when it was last left, so going back lands there.
 *
 * The browser's back button and a phone's back gesture are a `popstate`; the header's
 * back arrow is a link up one segment (see `BackButton`), which the router treats as a
 * new page. Both are "back" to the person pressing them, so both come back to where
 * they were, and everything else starts at the top.
 */
const scrolledTo = new Map<string, number>();

/** The path a `popstate` landed on, until the page change it causes has been drawn. */
let traversedTo: string | null = null;

if (typeof window !== "undefined") {
  // Not capturing: a sheet taking its own entry back off swallows that traverse in a
  // capturing listener (`popOwnEntry` in `modal.tsx`), and it is not a change of page.
  window.addEventListener("popstate", () => {
    traversedTo = window.location.pathname;
  });
}

/**
 * Starts a page that was gone to at the top, and one that was gone back to where it was
 * left.
 *
 * The window is what scrolls, and the router's own reset only scrolls a page whose top
 * is out of view into view, under the sticky header — so a page opened from far down
 * another was opened part way down itself. A layout effect, so the page is never painted
 * at the old position first.
 */
function useScrollOnArrival(from: string, to: string) {
  useLayoutEffect(() => {
    if (from === to) return;
    const traversed = traversedTo === to;
    traversedTo = null;
    // The browser puts a page it traversed to back where it was by itself.
    if (traversed) return;
    const back = from.startsWith(`${to}/`);
    window.scrollTo(0, back ? (scrolledTo.get(to) ?? 0) : 0);
  }, [from, to]);

  // Kept as the page scrolls rather than read on the way out: by the time the new path
  // is known, the old page's content has already been swapped for the new one's.
  useLayoutEffect(() => {
    const remember = () => scrolledTo.set(to, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [to]);
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
  useScrollOnArrival(trail.from, trail.to);

  return (
    <div key={pathname} className={directionOf(trail.from, pathname)}>
      {children}
    </div>
  );
}
