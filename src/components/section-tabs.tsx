"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { letsGoBack, sidewaysIntent } from "@/lib/edge-swipe";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { useLanguage } from "./language-provider";
import { usePendingHref } from "./use-pending-href";
import { PAGE_ID, PageLeaving, motionBetween } from "./page-transition";
import { replacingNext } from "./back-button";
import { SETTINGS_TABS } from "@/lib/settings-tabs";

/**
 * The pages inside one tab. A tab is an area of the household's life, and these are
 * its pages, a sideways step apart. Drawn only on a segment's own top-level page — a
 * recipe or an open list is somewhere you went *into*, and the back arrow takes you out.
 */
export const SECTIONS: { href: string; key: keyof typeof APP.sections }[][] = [
  [
    { href: "/recipes", key: "recipes" },
    { href: "/meals", key: "meals" },
  ],
  [
    { href: "/lists", key: "lists" },
    { href: "/pantry", key: "supplies" },
  ],
  SETTINGS_TABS.map((tab) => ({ href: tab.href, key: tab.key })),
];

/** The sections as paths, for which way a page comes in (`pageMotion`). */
export const SECTION_PATHS: string[][] = SECTIONS.map((section) => section.map((seg) => seg.href));

/**
 * One pill, sliding under the segments rather than one per segment changing colour, so
 * the eye follows it across. It moves on the press (`usePendingHref`), not when the page
 * lands: the page behind it can take half a second, and a control that waits for the
 * server reads as one that did not hear the tap. It is drawn only on a segment's own page
 * and stays mounted between them, which is what lets it slide at all.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const say = sayIn(useLanguage());
  const { pending, pressed } = usePendingHref();
  const router = useRouter();
  const section = SECTIONS.find((s) => s.some((seg) => seg.href === pathname));

  const shown = pending ?? pathname;
  const at = section ? Math.max(0, section.findIndex((seg) => seg.href === shown)) : 0;

  const drag = useSectionSwipe(section ?? null, at, (href) => {
    replacingNext();
    pressed(href);
    router.replace(href);
  });
  if (!section) return null;

  return (
    <nav className="relative -mt-4 mb-5 flex rounded-full bg-slate-200/70 p-1">
      <span
        aria-hidden="true"
        className={`absolute inset-y-1 left-1 rounded-full bg-[var(--accent)] shadow-sm ${
          drag === 0 ? "transition-[translate] duration-(--dur-base) ease-(--ease-arrive)" : ""
        }`}
        style={{
          width: `calc((100% - 0.5rem) / ${section.length})`,
          // While a finger drags the page, the pill goes with it towards the page it would land on.
          translate: `${(at + drag) * 100}% 0`,
        }}
      />
      {section.map((seg, index) => {
        const active = seg.href === pathname;
        return (
          <Link
            key={seg.href}
            href={seg.href}
            prefetch
            replace
            onNavigate={() => {
              replacingNext();
              pressed(seg.href);
            }}
            aria-current={active ? "page" : undefined}
            className={`press-button relative min-w-0 flex-1 truncate rounded-full py-2 text-center font-semibold ${
              // Five to a pill (Settings) is too many for the size two are drawn at.
              section.length > 3 ? "px-0.5 text-xs" : "text-sm"
            } ${
              index === at ? "text-white" : "text-slate-500"
            }`}
          >
            {say(APP.sections[seg.key])}
            <PageLeaving motion={motionBetween(pathname, seg.href)} />
          </Link>
        );
      })}
    </nav>
  );
}

/** How long the page takes to slide the rest of the way, or back, after the finger lets go. */
const SETTLE_MS = 200;

/** Whether a touch began on something that scrolls sideways itself (a row of chips). */
function inSidewaysScroller(target: EventTarget | null) {
  for (let el = target instanceof Element ? target : null; el && el.id !== PAGE_ID; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

/**
 * On a phone, a finger moving sideways across a section's page drags the page with it, and
 * the pill above it towards the page it would land on; let go far or fast enough and the
 * page beside it arrives (`go`), else it slides back. There is no page past either end, so
 * dragging that way only gives a little. Returns how far the pill has followed, in
 * segments (0 when nothing is dragged).
 */
function useSectionSwipe(
  section: { href: string }[] | null,
  at: number,
  go: (href: string) => void,
): number {
  const pathname = usePathname();
  const [drag, setDrag] = useState(0);
  const state = useRef({ section, at, go });
  useEffect(() => {
    state.current = { section, at, go };
  });

  // The page that slid out is the same element the next page comes into.
  useLayoutEffect(() => {
    const el = document.getElementById(PAGE_ID);
    if (el?.dataset.swiping !== undefined) {
      el.style.removeProperty("translate");
      el.style.removeProperty("transition");
      delete el.dataset.swiping;
    }
    setDrag(0);
  }, [pathname]);

  const active = section !== null;
  useEffect(() => {
    if (!active) return;
    let touch: {
      x: number;
      y: number;
      lastX: number;
      lastT: number;
      speed: number;
      intent: ReturnType<typeof sidewaysIntent>;
    } | null = null;

    /** The neighbour a drag of `dx` heads for, or null past an end. */
    const target = (dx: number) => {
      const { section: segs, at: index } = state.current;
      const next = dx < 0 ? index + 1 : index - 1;
      return segs && next >= 0 && next < segs.length ? segs[next]!.href : null;
    };

    const start = (event: TouchEvent) => {
      touch = null;
      const point = event.touches[0]!;
      if (event.touches.length !== 1 || document.querySelector('[aria-modal="true"]')) return;
      const page = document.getElementById(PAGE_ID);
      if (!page || !page.contains(event.target as Node) || inSidewaysScroller(event.target)) return;
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
      }
      if (touch.intent === "undecided") return;
      event.preventDefault();
      const el = document.getElementById(PAGE_ID);
      if (!el) return;
      const dt = event.timeStamp - touch.lastT;
      if (dt > 0) touch.speed = (point.clientX - touch.lastX) / dt;
      touch.lastX = point.clientX;
      touch.lastT = event.timeStamp;
      // Past an end there is nothing to go to: the page gives a little and no more.
      const shift = target(dx) ? dx : dx / 4;
      el.dataset.swiping = "";
      el.style.transition = "none";
      el.style.translate = `${shift}px 0`;
      setDrag(target(dx) ? -dx / window.innerWidth : 0);
    };

    const end = () => {
      const done = touch;
      touch = null;
      const el = document.getElementById(PAGE_ID);
      if (!done || done.intent === "undecided" || done.intent === "other" || !el) return;
      const dx = done.lastX - done.x;
      const width = window.innerWidth;
      const href = target(dx);
      el.style.transition = `translate ${SETTLE_MS}ms var(--ease-arrive)`;
      if (href && letsGoBack(Math.abs(dx), width, Math.abs(done.speed))) {
        el.style.translate = `${dx < 0 ? -width : width}px 0`;
        // The press moves the pill the rest of the way (`usePendingHref`).
        setDrag(0);
        state.current.go(href);
        return;
      }
      el.style.translate = "0px 0";
      setDrag(0);
      window.setTimeout(() => {
        el.style.removeProperty("translate");
        el.style.removeProperty("transition");
        delete el.dataset.swiping;
      }, SETTLE_MS);
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }, [active]);

  return drag;
}
