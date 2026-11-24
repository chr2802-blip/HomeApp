"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, navItemsFor, type NavItem } from "./nav-items";
import { NavPins, useNavPins } from "./nav-pins";
import { usePendingHref } from "./use-pending-href";
import { useLanguage } from "./language-provider";
import { useLeaveHome } from "./home-banner";
import { PageLeaving, motionBetween } from "./page-transition";
import { CreateMenu } from "./create-button";
import { Modal, ModalBody } from "./modal";
import { sayIn } from "@/lib/copy/say";
import { NAV } from "@/lib/copy/nav";
import { litPlace, type PinnableTab } from "@/lib/nav-tabs";

type Pill = { x: number; y: number; moved: boolean };

/**
 * The phone's tab bar: Home · the person's two pins · Menu, with the page's "+" in the
 * middle (`CreateFab`; on a page that makes nothing, the bar's own `CreateMenu`). On a
 * desktop every tab is `NavLinks` in the header instead.
 *
 * Home and the "+" are always there. The two places between are the person's own
 * (`User.navPins`), and Menu opens a drawer of every tab, pinned or not, where the pins
 * are chosen. A page whose tab is not in the bar — or which is in no tab at all — lights
 * Menu, because that is where it is reached from (`litPlace`).
 *
 * A place lights up the moment it is tapped, not when its page has arrived
 * (`usePendingHref`). One light glides between them; until it has been measured, the lit
 * place draws its own, so the first paint is right.
 */
export function BottomNav({ pins: stored }: { pins: PinnableTab[] }) {
  const pathname = usePathname();
  const language = useLanguage();
  const say = sayIn(language);
  const all = navItemsFor(language);
  const [pins, setPins] = useNavPins(stored);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pending, pressed } = usePendingHref();
  const leaveHome = useLeaveHome(pathname);

  const byKey = new Map(all.map((item) => [item.key, item]));
  const links: NavItem[] = [byKey.get("dashboard")!, ...pins.map((pin) => byKey.get(pin)!)];
  // The places in the bar, in order: the links, then the menu.
  const places = [...links.map((item) => item.key as string), "menu"];
  const lit = menuOpen ? "menu" : litPlace(pending ?? pathname, pins);
  const litIndex = places.indexOf(lit);
  const middle = 2;

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

  const face = (index: number, Icon: NavItem["icon"], label: string) => {
    const on = index === litIndex;
    return (
      <>
        {/* The light grows as it arrives, so the place just pressed is the thing that
            moved on the screen. The property eased is `scale`, not `transform`: that is
            what Tailwind's scale-* writes. */}
        <span
          ref={(el) => {
            icons.current[index] = el;
          }}
          className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-[background-color,color,scale] duration-(--dur-base) ease-(--ease-spring) ${
            on ? `scale-110 text-white ${pill ? "" : "bg-[var(--accent)]"}` : "scale-100 text-slate-400"
          }`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span
          className={`truncate text-[11px] leading-none font-medium transition-colors duration-(--dur-quick) ${
            on ? "font-semibold text-[var(--accent-text)]" : "text-slate-400"
          }`}
        >
          {label}
        </span>
      </>
    );
  };

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
        {links.map((item, index) => (
          <Fragment key={item.key}>
            {/*
             * The middle, kept for the page's "+" (`CreateFab`). A page with nothing of its
             * own to make shows the bar's `CreateMenu` here instead, so the "+" is a place to
             * start from on every tab — and is hidden by CSS the moment the page's own comes.
             */}
            {index === middle && (
              <li className="relative w-16 shrink-0">
                <CreateMenu inBar />
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
                aria-current={litPlace(pathname, pins) === item.key ? "page" : undefined}
                className="press-icon group flex flex-col items-center gap-1 px-0.5 pt-2.5 pb-2"
              >
                {face(index, item.icon, item.label)}
                <PageLeaving motion={motionBetween(pathname, item.href)} />
              </Link>
            </li>
          </Fragment>
        ))}
        <li className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={say(NAV.menu)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className="press-icon group flex w-full flex-col items-center gap-1 px-0.5 pt-2.5 pb-2"
          >
            {face(links.length, MenuIcon, say(NAV.menu))}
          </button>
        </li>
      </ul>
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title={say(NAV.allTabs)} size="drawer">
        <ModalBody>
          <p className="-mt-1 mb-3 text-sm text-slate-500">{say(NAV.hint)}</p>
          <NavPins
            items={all}
            pins={pins}
            onChange={setPins}
            pathname={pathname}
            onOpen={(href) => {
              pressed(href);
              setMenuOpen(false);
            }}
          />
        </ModalBody>
      </Modal>
    </nav>
  );
}
