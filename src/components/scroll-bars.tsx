"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** How far a scroll goes while the bars travel all the way out (or in). */
const DISTANCE = 90;
/** Near the top of the page the bars always show. */
const TOP = 64;
/** How long the page must be still before the bars settle all the way in or out. */
const SETTLE_MS = 140;
/** This close to the end of the page counts as the end. */
const END = 4;

/**
 * Moves the header, the tab bar, the "+" and what floats above the bar (the kitchen's
 * timers, a snack) with the scroll: down a page they slide out as
 * far as the page has moved, back up they slide in, and when the scrolling stops they
 * settle the rest of the way, whichever way is nearer. They come back on a new page, at
 * the top of one, and at the end of one, where there is nothing left to read.
 *
 * Only scrolling moves them. A phone's browser shows and hides its own toolbar near the
 * end of a page, which changes the window's height and so where the end is; read as a
 * scroll, that jerked the bars half-way and back. A change of height moves nothing, nor
 * does the scroll the browser sends after it, which has moved nothing.
 *
 * It writes `--bars` on <html> (0 shown, 1 gone; the CSS is in globals.css), and
 * `data-bars`: "hidden" once all the way out, "live" while following the finger, when
 * the CSS turns the bars' own easing off so they do not lag behind it.
 */
export function ScrollBars() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    let shown = 0; // how far out the bars are, 0..1
    let last = window.scrollY;
    let height = window.innerHeight;
    let frame = 0;
    let timer = 0;

    const write = (next: number, live: boolean) => {
      shown = next;
      root.style.setProperty("--bars", String(next));
      if (live && next > 0 && next < 1) root.dataset.bars = "live";
      else if (next === 1) root.dataset.bars = "hidden";
      else delete root.dataset.bars;
    };

    const settle = () => write(shown >= 0.5 ? 1 : 0, false);

    const update = () => {
      frame = 0;
      // iOS bounces past both ends; read the position clamped to the page.
      const max = Math.max(0, root.scrollHeight - window.innerHeight);
      const y = Math.min(Math.max(window.scrollY, 0), max);
      const moved = y - last;
      last = y;
      if (window.innerHeight !== height) {
        // The window changed size, not the scroll: start counting again from here, and
        // leave any settling that is under way to finish.
        height = window.innerHeight;
        return;
      }
      // A scroll that moved nothing moves nothing. The browser sends one a frame after the
      // window grew, for the page it pulled back to its new end — which was read with the
      // resize above — and read as a scroll to the end, it brought the bars back.
      if (moved === 0) return;
      window.clearTimeout(timer);
      if (y < TOP || y >= max - END) {
        write(0, false);
        return;
      }
      write(Math.min(1, Math.max(0, shown + moved / DISTANCE)), true);
      timer = window.setTimeout(settle, SETTLE_MS);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    write(0, false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      root.style.removeProperty("--bars");
      delete root.dataset.bars;
    };
  }, [pathname]);

  return null;
}
