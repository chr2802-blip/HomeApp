"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { pageMotion, type PageMotion } from "@/lib/page-motion";
import { SECTION_PATHS } from "./section-tabs";
import { TAB_PATHS } from "./nav-items";

export const PAGE_ID = "app-page";

/** Which way a page comes in going from `from` to `to`; see `pageMotion`. */
export function motionBetween(from: string, to: string): PageMotion | null {
  return pageMotion(from, to, TAB_PATHS, SECTION_PATHS);
}

/** The back arrow was pressed: the next page closes the one on screen, whatever the paths say. */
let goingBack = false;

/** Called by the back arrow (and the edge swipe) just before it leaves. */
export function closeNext() {
  goingBack = true;
}

/**
 * How dimmed the page was when it stopped stepping aside, and when: the page that comes in
 * starts from there, so the screen never jumps to bright and back.
 */
let leftAt: { opacity: string; at: number } | null = null;
/** A page that let go longer ago than this did not let go for the page now coming in. */
const LEFT_JUST_NOW_MS = 100;

/**
 * Where each page was scrolled to when it was last left, so going back lands there.
 *
 * The browser's back button and a phone's back gesture are a `popstate`; the header's
 * back arrow is either one of those or a link up one segment (see `BackButton`), which
 * the router treats as a new page. Both are "back" to the person pressing them, so both
 * come back to where they were, and everything else starts at the top.
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
 * What every page of the app sits in. When the address changes the new page comes in from
 * the side its tab is on, opens out of the page above it, or closes back into it
 * (`pageMotion`); the CSS is `.app-page` in globals.css.
 *
 * Nothing is remounted: the animation is started again on the same element, so the page
 * keeps its state when only its address moves, and the edge swipe can hand the element it
 * dragged straight to the page arriving in it.
 *
 * The browser's own back and forward bring nothing in: a phone draws its own slide for the
 * back swipe, and a second one on top of it reads as a stutter. The header's back arrow is
 * ours, and closes its page whichever way it goes (`closeNext`).
 *
 * It also starts a page gone to at the top, and one gone back to where it was left. The
 * window is what scrolls, and the router's own reset only scrolls a page whose top is out
 * of view into view, under the sticky header — so a page opened from far down another was
 * opened part way down itself.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const page = useRef<HTMLDivElement>(null);
  const last = useRef(pathname);

  useLayoutEffect(() => {
    const el = page.current;
    const from = last.current;
    last.current = pathname;
    if (!el || from === pathname) return;

    const traversed = traversedTo === pathname;
    traversedTo = null;
    const back = goingBack;
    goingBack = false;

    // The browser puts a page it traversed to back where it was by itself.
    if (!traversed) {
      const up = back || from.startsWith(`${pathname}/`);
      window.scrollTo(0, up ? (scrolledTo.get(pathname) ?? 0) : 0);
    }

    const motion: PageMotion | null = back ? "close" : traversed ? null : motionBetween(from, pathname);
    el.dataset.motion = motion ?? "none";
    const left = leftAt && performance.now() - leftAt.at < LEFT_JUST_NOW_MS ? leftAt.opacity : "1";
    leftAt = null;
    if (!motion) return;
    el.style.setProperty("--page-from", left);
    // The same way twice in a row is the same animation: stop it and let it start over.
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }, [pathname]);

  // Kept as the page scrolls rather than read on the way out: by the time the new path
  // is known, the old page's content has already been swapped for the new one's.
  useEffect(() => {
    const remember = () => scrolledTo.set(pathname, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [pathname]);

  return (
    <div ref={page} id={PAGE_ID} data-motion="first" className="app-page">
      {children}
    </div>
  );
}

/**
 * Inside a link: while the link's page is on its way, the page on screen dims, so a tap is
 * answered at once and not when the server has. It only dims — a page that also moved was
 * cut off mid-move when the new one arrived, which read as a stutter. It hangs on the
 * link's own pending state, so it lets go whenever the navigation ends, also one that
 * ends where it began.
 */
export function PageLeaving({ motion }: { motion: PageMotion | null }) {
  const { pending } = useLinkStatus();
  useLayoutEffect(() => {
    const el = document.getElementById(PAGE_ID);
    if (!pending || !motion || !el) return;
    el.dataset.leaving = motion;
    return () => {
      leftAt = { opacity: getComputedStyle(el).opacity, at: performance.now() };
      delete el.dataset.leaving;
    };
  }, [pending, motion]);
  return null;
}
