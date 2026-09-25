"use client";

import { useEffect, useState } from "react";
import type { PantryCategory, PantryUnit } from "@prisma/client";
import { Card } from "@/components/ui";
import { PantryRow } from "@/components/pantry-row";
import { PantrySortButton } from "@/components/pantry-sort-button";
import { useLanguage } from "@/components/language-provider";
import { PANTRY_CATEGORIES, pantryKey } from "@/lib/pantry";
import { lookupGood } from "@/lib/pantry-goods";
import { sayIn } from "@/lib/copy/say";
import { PANTRY, PANTRY_CATEGORY_LABELS } from "@/lib/copy/pantry";

export type ShelfEntry = {
  id: string;
  name: string;
  key: string;
  quantity: number;
  unit: PantryUnit | null;
  category: PantryCategory | null;
};

/**
 * The add sheet's way of saying "show this row": an event rather than a direct scroll,
 * because the row it means may be one the filter here is hiding, and only this component
 * knows to clear the filter first.
 */
export const SHOW_PANTRY_ROW = "pantry-show";

export function showPantryRow(id: string) {
  window.dispatchEvent(new CustomEvent<string>(SHOW_PANTRY_ROW, { detail: id }));
}

/**
 * The shelves, and a way to narrow them: a search box and a "run out" switch.
 *
 * The search reads the name, the key and the shelf's own name, so "krydder" narrows the
 * page to the spice shelf as readily as "ris" narrows it to rice. "Only run out" is the
 * question somebody writing a shopping list asks of a cupboard, which the shelves alone
 * answer only by reading every row.
 *
 * **A row the filter leaves out is hidden, never unmounted.** Each row holds optimistic
 * state — a quantity or a name on its way to the server — and a row that left the tree
 * mid-flight would drop it, and come back saying the stored value until the refresh
 * landed. So the rows stay put under `hidden`, and a shelf with nothing showing hides its
 * heading too.
 *
 * Neither the search nor the switch is kept anywhere: both start empty on every visit,
 * because a pantry that opened already filtered would be one that looked half empty.
 */
export function PantryShelves({ items }: { items: ShelfEntry[] }) {
  const say = sayIn(useLanguage());
  const [query, setQuery] = useState("");
  const [runOutOnly, setRunOutOnly] = useState(false);

  // "Show it", from the add sheet: clear anything that might be hiding the row, then — once
  // that has been drawn — bring it into view and wash it in the home's colour.
  useEffect(() => {
    function onShow(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      setQuery("");
      setRunOutOnly(false);
      requestAnimationFrame(() => {
        const row = document.getElementById(`pantry-${id}`);
        if (!row) return;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        // Restarting the wash: a class taken off and put back in one frame is a class the
        // browser never saw leave, so the animation would not play a second time.
        row.classList.remove("animate-pantry-found");
        void row.offsetWidth;
        row.classList.add("animate-pantry-found");
      });
    }
    window.addEventListener(SHOW_PANTRY_ROW, onShow);
    return () => window.removeEventListener(SHOW_PANTRY_ROW, onShow);
  }, []);

  const needle = query.trim().toLowerCase();
  const needleKey = pantryKey(query);
  const shelfName = (category: PantryCategory | null) =>
    category ? say(PANTRY_CATEGORY_LABELS[category]) : say(PANTRY.unsorted);

  const shows = (item: ShelfEntry) =>
    (!runOutOnly || item.quantity === 0) &&
    (!needle ||
      item.name.toLowerCase().includes(needle) ||
      (needleKey !== "" && item.key.includes(needleKey)) ||
      shelfName(item.category).toLowerCase().includes(needle));

  // Unsorted first, then every shelf in its fixed order; the query's own name order is
  // kept inside each.
  const shelves: (PantryCategory | null)[] = [null, ...PANTRY_CATEGORIES];
  const groups = shelves
    .map((category) => {
      const entries = items.filter((item) => item.category === category);
      return { category, entries, shown: entries.filter(shows).length };
    })
    .filter((group) => group.entries.length > 0);
  const nothingShown = groups.every((group) => group.shown === 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={say(PANTRY.filterLabel)}
          placeholder={say(PANTRY.filterPlaceholder)}
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm outline-none focus-visible:border-slate-500"
        />
        <button
          type="button"
          aria-pressed={runOutOnly}
          onClick={() => setRunOutOnly((on) => !on)}
          className={`pressable h-9 shrink-0 rounded-full border px-3 text-sm ${
            runOutOnly
              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {say(PANTRY.onlyRunOut)}
        </button>
      </div>

      {nothingShown && (
        <p className="mt-4 px-1 text-sm text-slate-500" role="status">
          {runOutOnly && !needle ? say(PANTRY.nothingRunOut) : say(PANTRY.noMatches, { query: query.trim() })}{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRunOutOnly(false);
            }}
            className="font-medium text-[var(--accent-text)] underline underline-offset-2"
          >
            {say(PANTRY.clearFilter)}
          </button>
        </p>
      )}

      {groups.map(({ category, entries, shown }) => (
        <section
          key={category ?? "unsorted"}
          hidden={shown === 0}
          className="mt-5"
          data-shelf={category ?? "UNSORTED"}
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <h2 className="text-sm font-semibold text-slate-700">
              {shelfName(category)}{" "}
              <span className="font-normal text-slate-400 tabular-nums">{shown}</span>
            </h2>
            {category === null && (
              <PantrySortButton asksAi={entries.some((entry) => !lookupGood(entry.name))} />
            )}
          </div>
          {/* A rule between two rows that are both showing, rather than `divide-y`, which
              counts hidden rows and leaves a line under the last one drawn. */}
          <Card className="p-0 [&>:not([hidden])~:not([hidden])]:border-t [&>:not([hidden])~:not([hidden])]:border-slate-100">
            {entries.map((item) => (
              <div key={item.id} hidden={!shows(item)}>
                <PantryRow
                  id={item.id}
                  name={item.name}
                  quantity={item.quantity}
                  unit={item.unit}
                  category={item.category}
                />
              </div>
            ))}
          </Card>
        </section>
      ))}
    </>
  );
}
