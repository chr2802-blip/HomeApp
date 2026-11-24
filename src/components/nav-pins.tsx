"use client";

import { startTransition, useOptimistic, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./language-provider";
import { SECTIONS } from "./section-tabs";
import { isInTab, navItemsFor, type NavItem } from "./nav-items";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { NAV } from "@/lib/copy/nav";
import { setNavPins } from "@/app/actions/nav";
import { PIN_FIELD, PINNABLE_TABS, pinInPlaceOf, swapPins, type PinnableTab } from "@/lib/nav-tabs";

/**
 * The pins as the server last said, with the press just made shown at once — the tab
 * bar under the drawer changes under the thumb, not a round trip later.
 */
export function useNavPins(stored: PinnableTab[]) {
  const [pins, show] = useOptimistic(stored);
  const change = (next: PinnableTab[]) =>
    startTransition(async () => {
      show(next);
      const form = new FormData();
      for (const pin of next) form.append(PIN_FIELD, pin);
      await setNavPins(form);
    });
  return [pins, change] as const;
}

/**
 * Every tab, with the two in the tab bar first, and the controls that choose them: the
 * menu's drawer draws it with each name a way to its page, `/profile` without.
 *
 * Pinning when both places are taken asks which one makes way, right under the row,
 * rather than quietly replacing the second: the bar is what a thumb has learned, and a
 * tab moving out of it unannounced is a tab somebody goes looking for.
 */
export function NavPins({
  items,
  pins,
  onChange,
  pathname,
  onOpen,
}: {
  items: NavItem[];
  pins: PinnableTab[];
  onChange: (pins: PinnableTab[]) => void;
  /** Where the reader is, so the row for that tab can say so. */
  pathname?: string;
  /** Given, every name is a link, and this is told which one was pressed. */
  onOpen?: (href: string) => void;
}) {
  const say = sayIn(useLanguage());
  const [asking, setAsking] = useState<PinnableTab | null>(null);
  const byKey = new Map(items.map((item) => [item.key, item]));
  const pinned = pins.map((key) => byKey.get(key)!).filter(Boolean);
  const others = items.filter(
    (item) => item.key !== "dashboard" && !(pins as string[]).includes(item.key),
  );
  const home = byKey.get("dashboard");

  const parts = (item: NavItem) => {
    const section = SECTIONS.find((s) => s.some((seg) => seg.href === item.href));
    return section ? section.map((seg) => say(APP.sections[seg.key])).join(" · ") : null;
  };

  const row = (item: NavItem, controls: React.ReactNode, note?: string) => {
    const Icon = item.icon;
    const here = pathname !== undefined && isInTab(item, pathname);
    const sub = here ? say(NAV.youAreHere) : (note ?? parts(item));
    const label = (
      <>
        <span className="block font-semibold text-slate-800">{item.label}</span>
        {sub && (
          <span className={`block truncate text-xs ${here ? "font-semibold text-[var(--accent-text)]" : "text-slate-500"}`}>
            {sub}
          </span>
        )}
      </>
    );
    return (
      <li key={item.key} className="flex min-h-14 items-center gap-3 py-1.5">
        <span aria-hidden="true" className="accent-tint-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--accent-text)]">
          <Icon className="h-5 w-5" />
        </span>
        {onOpen ? (
          <Link
            href={item.href}
            onClick={() => onOpen(item.href)}
            aria-current={here ? "page" : undefined}
            className="press-text min-w-0 flex-1 py-1"
          >
            {label}
          </Link>
        ) : (
          <span className="min-w-0 flex-1">{label}</span>
        )}
        {controls}
      </li>
    );
  };

  const chip = "press-button flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold";

  return (
    <div className="flex flex-col gap-3">
      {home && onOpen && <ul>{row(home, null)}</ul>}

      <section>
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{say(NAV.inBar)}</h3>
        <ul>
          {pinned.map((item, index) =>
            row(
              item,
              <>
                {index === 0 && (
                  <button
                    type="button"
                    onClick={() => onChange(swapPins(pins))}
                    aria-label={say(NAV.swap)}
                    title={say(NAV.swap)}
                    className="press-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4" />
                    </svg>
                  </button>
                )}
                <span className={`${chip} border-[var(--accent)] bg-[var(--accent)] text-white`} data-place={index + 1}>
                  {say(NAV.place).replace("{n}", String(index + 1))}
                </span>
              </>,
            ),
          )}
        </ul>
      </section>

      {others.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{say(NAV.moreTabs)}</h3>
          <ul>
            {others.map((item) => {
              const key = item.key as PinnableTab;
              if (!(PINNABLE_TABS as readonly string[]).includes(key)) return row(item, null);
              const open = asking === key;
              return [
                row(
                  item,
                  <button
                    type="button"
                    onClick={() => setAsking(open ? null : key)}
                    aria-expanded={open}
                    aria-label={say(NAV.pinNamed).replace("{name}", item.label)}
                    className={`${chip} border-slate-200 bg-white text-slate-600`}
                  >
                    <PinIcon />
                    {say(NAV.pin)}
                  </button>,
                ),
                open && (
                  <li key={`${key}-replace`} className="mb-2 ml-[3.25rem] flex flex-col gap-2">
                    <span className="text-sm text-slate-600">{say(NAV.barFull)}</span>
                    <span className="flex gap-2">
                      {pinned.map((current) => (
                        <button
                          key={current.key}
                          type="button"
                          onClick={() => {
                            setAsking(null);
                            onChange(pinInPlaceOf(pins, key, current.key as PinnableTab));
                          }}
                          className={`${chip} h-10 flex-1 justify-center border-slate-200 bg-white text-slate-700`}
                        >
                          {say(NAV.replace).replace("{name}", current.label)}
                        </button>
                      ))}
                    </span>
                  </li>
                ),
              ];
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z" />
    </svg>
  );
}

/** The same choice on `/profile`, where it is a setting rather than a way somewhere. */
export function NavPinsSetting({ pins: stored }: { pins: PinnableTab[] }) {
  const language = useLanguage();
  const [pins, setPins] = useNavPins(stored);
  return <NavPins items={navItemsFor(language)} pins={pins} onChange={setPins} />;
}
