"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isInTab, navItemsFor } from "./nav-items";
import { usePendingHref } from "./use-pending-href";
import { useLanguage } from "./language-provider";
import { useLeaveHome } from "./home-banner";
import { PageLeaving, motionBetween } from "./page-transition";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

type Pill = { x: number; y: number; moved: boolean };

/**
 * The phone's tab bar, with the page's "+" in the middle (`CreateFab`, greyed out here
 * where the page has nothing to make). On a desktop the same destinations are `NavLinks`
 * in the header.
 *
 * A tab lights up the moment it is tapped, not when its page has arrived (`usePendingHref`).
 * One light glides between the tabs; until it has been measured, the lit tab draws its own,
 * so the first paint is right.
 */
export function BottomNav() {
  const pathname = usePathname();
  const language = useLanguage();
  const say = sayIn(language);
  const items = navItemsFor(language);
  const { pending, pressed } = usePendingHref();
  const leaveHome = useLeaveHome(pathname);
  const litIndex = pending
    ? items.findIndex((item) => item.href === pending)
    : items.findIndex((item) => isInTab(item, pathname));
  const middle = Math.floor(items.length / 2);

  const list = useRef<HTMLUListElement>(null);
  const icons = useRef<(HTMLSpanElement | null)[]>([]);
  const [pill, setPill] = useState<Pill | null>(null);

  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const measure = () => {
      const icon = icons.current[litIndex];
      if (!icon) return setPill(null);
      const box = icon.getBoundingClientRect();
      const frame = ul.getBoundingClientRect();
      const x = box.left - frame.left + box.width / 2;
      const y = box.top - frame.top + box.height / 2;
      // The first placement does not glide in from nowhere.
      setPill((last) => (last && last.x === x && last.y === y ? last : { x, y, moved: last !== null }));
    };
    measure();
    // The tabs move when the screen turns.
    const observer = new ResizeObserver(measure);
    for (const li of ul.children) observer.observe(li);
    return () => observer.disconnect();
  }, [litIndex]);

  return (
    <nav className="app-bottombar fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-[var(--accent-line)] bg-[#ffffff] shadow-[0_-10px_28px_-18px_rgb(80_55_30/0.45)] md:hidden">
      {/* The tabs sit above the phone's gesture bar and the band behind them runs on
          underneath it: the page is laid out to the bottom edge of the screen, so this
          padding is the only thing keeping the row off the bar, and the strip it leaves
          is what makes the phone's own bottom bar the app's colour rather than the
          manifest's. */}
      <ul ref={list} className="relative mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
        {pill && litIndex >= 0 && (
          <li
            aria-hidden="true"
            data-testid="tab-pill"
            className={`pointer-events-none absolute top-0 left-0 h-7 w-12 rounded-full bg-[var(--accent)] ${pill.moved ? "app-pill" : ""}`}
            style={{ translate: `${pill.x - 24}px ${pill.y - 14}px`, scale: "1.1" }}
          />
        )}
        {items.map((item, index) => {
          const active = isInTab(item, pathname);
          const lit = index === litIndex;
          const Icon = item.icon;
          return (
            <Fragment key={item.href}>
              {/*
               * The middle, kept for the page's "+" (`CreateFab`). A page with nothing to
               * make shows it greyed out here, so the bar looks the same on every tab. Its
               * name is not the page's own: it is drawn before the page's "+" has come, and
               * a press meant for that one must wait for it rather than land on this.
               */}
              {index === middle && (
                <li className="relative w-16 shrink-0">
                  <button
                    type="button"
                    disabled
                    aria-label={say(APP.nothingToAdd)}
                    title={say(APP.nothingToAdd)}
                    className="app-create-idle absolute bottom-2.5 left-1/2 flex h-14 w-14 -translate-x-1/2 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 text-slate-300 ring-4 ring-[#ffffff]"
                  >
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </li>
              )}
              <li className="relative min-w-0 flex-1">
                <Link
                  href={item.href}
                  prefetch
                  onClick={(event) => {
              leaveHome(event, item.href);
              // Held back while the banner rolls up, so the tab lights here instead.
              if (event.defaultPrevented) pressed(item.href);
            }}
            onNavigate={() => pressed(item.href)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className="press-icon group flex flex-col items-center gap-1 px-0.5 pt-2.5 pb-2"
                >
                  {/* The light grows as it arrives, so the tab just pressed is the thing
                      that moved on the screen. The property eased is `scale`, not
                      `transform`: that is what Tailwind's scale-* writes. */}
                  <span
                    ref={(el) => {
                      icons.current[index] = el;
                    }}
                    className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,color,scale] duration-(--dur-base) ease-(--ease-spring) ${
                      lit ? `scale-110 text-white ${pill ? "" : "bg-[var(--accent)]"}` : "scale-100 text-slate-400"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span
                    className={`truncate text-[11px] leading-none font-medium transition-colors duration-(--dur-quick) ${
                      lit ? "font-semibold text-[var(--accent-text)]" : "text-slate-400"
                    }`}
                  >
                    {item.label}
                  </span>
                  <PageLeaving motion={motionBetween(pathname, item.href)} />
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}
