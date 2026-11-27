"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { letsGoBack, sidewaysIntent } from "@/lib/edge-swipe";
import { PAGE_TURN_MS } from "@/lib/motion";
import { PAGER_PARAM, pagerIndex, pagerUrl } from "@/lib/pager";

/** Ask the pager on screen to turn to the page at `href` (the section pill's press). */
export const PAGER_GO = "pager-go";
/** The pager telling the pill how far a finger has dragged it, in pages (0 when let go). */
export const PAGER_DRAG = "pager-drag";


/** Whether a touch began on something that scrolls sideways itself (a row of chips). */
function inSidewaysScroller(target: EventTarget | null, root: Element) {
  for (let el = target instanceof Element ? target : null; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

/**
 * The pages of one section drawn side by side, on one address (`?tab=`), so the page
 * beside the one on screen is already there and follows the finger the moment a sideways
 * swipe starts — rather than arriving once the finger has let go and the server answered.
 * Turning is `history.replaceState`, not a navigation: nothing is fetched or remounted,
 * and the page refreshed by its own `router.refresh()` keeps every panel's state.
 *
 * The page not on screen is as tall as the screen at most, and is lifted to wherever the
 * page on screen is scrolled to while it slides in, so it shows its top, not a stretch
 * scrolled past; it takes over that scroll position once it has landed.
 */
export function SwipePager({ hrefs, children }: { hrefs: string[]; children: React.ReactNode[] }) {
  const params = useSearchParams();
  const index = pagerIndex(hrefs, params.get(PAGER_PARAM));
  // The page the scroll and the height belong to: the one on screen once it has landed.
  const [settled, setSettled] = useState(index);
  const [lifted, setLifted] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const state = useRef({ index, hrefs });
  useEffect(() => {
    state.current = { index, hrefs };
  });

  // Landed: the page that slid in becomes the one the page scrolls by, at the same place
  // on screen it was drawn while it slid.
  useLayoutEffect(() => {
    if (settled === index) return;
    const timer = window.setTimeout(() => {
      setSettled(index);
      if (lifted > 0) window.scrollTo(0, window.scrollY - lifted);
      setLifted(0);
    }, PAGE_TURN_MS);
    return () => window.clearTimeout(timer);
  }, [index, settled, lifted]);

  useEffect(() => {
    const el = root.current;
    const row = track.current;
    if (!el || !row) return;

    /**
     * How far the page on screen is scrolled past this pager's top, counted from under the
     * header (which may be sliding away with the scroll): the page beside it is lifted by
     * this, so its own top shows just under the header.
     */
    const scrolledIn = () => {
      const header = document.querySelector(".app-topbar")?.getBoundingClientRect().bottom ?? 0;
      return Math.max(0, Math.max(0, header) - el.getBoundingClientRect().top);
    };
    const place = (shift: number, animate: boolean) => {
      row.style.transition = animate ? "" : "none";
      row.style.translate = `calc(${-state.current.index * 100}% + ${shift}px) 0`;
    };
    const drag = (share: number) => window.dispatchEvent(new CustomEvent(PAGER_DRAG, { detail: share }));

    const turn = (next: number) => {
      const { index: at, hrefs: pages } = state.current;
      if (next === at || next < 0 || next >= pages.length) return;
      setLifted(scrolledIn());
      row.style.transition = "";
      row.style.translate = `${-next * 100}% 0`;
      // `null`, not the entry's own state: Next lets a replace carrying its own state past
      // untold, and the pill and this pager read `?tab=` through the router.
      window.history.replaceState(null, "", pagerUrl(window.location.href, pages[next]!));
      drag(0);
    };

    let touch: {
      x: number;
      y: number;
      lastX: number;
      lastT: number;
      speed: number;
      intent: ReturnType<typeof sidewaysIntent>;
    } | null = null;

    /** The page a drag of `dx` heads for, or null past an end. */
    const target = (dx: number) => {
      const { index: at, hrefs: pages } = state.current;
      const next = dx < 0 ? at + 1 : at - 1;
      return next >= 0 && next < pages.length ? next : null;
    };

    const start = (event: TouchEvent) => {
      touch = null;
      const point = event.touches[0]!;
      if (event.touches.length !== 1 || document.querySelector('[aria-modal="true"]')) return;
      if (inSidewaysScroller(event.target, el)) return;
      touch = { x: point.clientX, y: point.clientY, lastX: point.clientX, lastT: event.timeStamp, speed: 0, intent: "undecided" };
    };

    const move = (event: TouchEvent) => {
      if (!touch) return;
      const point = event.touches[0]!;
      const dx = point.clientX - touch.x;
      if (touch.intent === "undecided") {
        touch.intent = sidewaysIntent(dx, point.clientY - touch.y);
        if (touch.intent === "other") {
          touch = null;
          return;
        }
        if (touch.intent !== "undecided") setLifted(scrolledIn());
      }
      if (touch.intent === "undecided") return;
      event.preventDefault();
      const dt = event.timeStamp - touch.lastT;
      if (dt > 0) touch.speed = (point.clientX - touch.lastX) / dt;
      touch.lastX = point.clientX;
      touch.lastT = event.timeStamp;
      // Past an end there is nothing to go to: the page gives a little and no more.
      const goes = target(dx) !== null;
      place(goes ? dx : dx / 4, false);
      drag(goes ? -dx / el.clientWidth : 0);
    };

    const end = () => {
      const done = touch;
      touch = null;
      if (!done || done.intent === "undecided" || done.intent === "other") return;
      const dx = done.lastX - done.x;
      const next = target(dx);
      if (next !== null && letsGoBack(Math.abs(dx), el.clientWidth, Math.abs(done.speed))) {
        turn(next);
        return;
      }
      place(0, true);
      drag(0);
    };

    const go = (event: Event) => {
      const href = (event as CustomEvent<string>).detail;
      turn(state.current.hrefs.indexOf(href));
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    window.addEventListener(PAGER_GO, go);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      window.removeEventListener(PAGER_GO, go);
    };
  }, []);

  return (
    // Clipped sideways only, so nothing inside stops being sticky; out to the page's own
    // edges, so the page beside slides in from the screen's edge rather than the gutter's.
    <div ref={root} className="-mx-4 overflow-x-clip" data-pager>
      <div
        ref={track}
        className="flex items-start transition-[translate] duration-(--dur-base) ease-(--ease-arrive)"
        style={{ translate: `${-index * 100}% 0` }}
      >
        {children.map((page, at) => {
          const away = at !== settled;
          return (
            <section
              key={hrefs[at]}
              inert={at !== index}
              aria-hidden={at !== index}
              data-pager-page={at === index ? "shown" : "away"}
              className={`w-full shrink-0 px-4 ${away ? "max-h-svh overflow-hidden" : ""}`}
              style={away && lifted > 0 ? { translate: `0 ${lifted}px` } : undefined}
            >
              {page}
            </section>
          );
        })}
      </div>
    </div>
  );
}
