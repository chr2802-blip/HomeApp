"use client";

import { useEffect, useState } from "react";
import type { PantryCategory, PantryUnit } from "@prisma/client";
import { Card } from "@/components/ui";
import { PantryRow } from "@/components/pantry-row";
import { PantrySortButton } from "@/components/pantry-sort-button";
import { useLanguage } from "@/components/language-provider";
import { useFold } from "@/components/use-fold";
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
  expiresOn: string | null;
  photoId: string | null;
  /** Days left where the row should warn (`expiryWarning`), else null. */
  expiresIn: number | null;
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
 * **Every shelf starts folded**, and a folded shelf still says what is on it: its count,
 * how much of it has run out, and its names on one line. Drawn open, forty-odd rows were
 * eight screens of phone, and "what do we have" had no answer short of scrolling all of
 * them — folded, the whole cupboard is one screen and a shelf is a press away. A shelf
 * opens by itself where the answer is its rows: a search or "only run out" opens every
 * shelf holding a match, and an entry that arrives or moves opens the shelf it landed on.
 * A shut shelf's rows are `hidden` like a filtered one's, for the same reason.
 *
 * Neither the search, the switch nor which shelves are open is kept anywhere: all start
 * empty on every visit, because a pantry that opened already filtered would be one that
 * looked half empty.
 */
export function PantryShelves({
  items,
  addToList,
  cook,
  children,
}: {
  items: ShelfEntry[];
  /**
   * "Add to list" for what has run out — the same cart icon the recipe's ingredients
   * carry, drawn beside the run-out count and only while "Only run out" is on. That is
   * the moment the page is showing exactly what the press would add; the rest of the
   * time it was a labelled button beside the title taking room from the cupboard.
   */
  addToList?: React.ReactNode;
  /** "What can we cook?", beside the count — the cupboard as a whole is what it asks about. */
  cook?: React.ReactNode;
  /** What an empty pantry shows instead of the shelves. */
  children: React.ReactNode;
}) {
  const say = sayIn(useLanguage());
  const [query, setQuery] = useState("");
  const [runOutOnly, setRunOutOnly] = useState(false);
  // Which shelves have been opened by hand. Every shelf starts shut, like every other
  // fold in the app, so the first screen is the whole cupboard a shelf to a line.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  // Where each entry was last seen. An entry that arrives, or moves shelf — added from
  // the sheet, filed by the sort, moved in the edit sheet — opens the shelf it landed
  // on, so the thing just done is on screen rather than folded away under a count.
  // Adjusted during render rather than in an effect, the same trick as the stepper's.
  const [seen, setSeen] = useState(items);
  if (seen !== items) {
    const was = new Map(seen.map((item) => [item.id, item.category]));
    const landed = items.filter((item) => was.get(item.id) !== item.category);
    setSeen(items);
    if (landed.length > 0) {
      setOpened((current) => {
        const next = new Set(current);
        for (const item of landed) next.add(item.category ?? "UNSORTED");
        return next;
      });
    }
  }
  const toggle = (shelf: string) =>
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(shelf)) next.delete(shelf);
      else next.add(shelf);
      return next;
    });

  // "Show it", from the add sheet: clear anything that might be hiding the row, then — once
  // that has been drawn — bring it into view and wash it in the home's colour.
  useEffect(() => {
    function onShow(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      setQuery("");
      setRunOutOnly(false);
      const shelf = items.find((item) => item.id === id)?.category ?? "UNSORTED";
      setOpened((current) => new Set(current).add(shelf));
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
  }, [items]);

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
      return {
        category,
        entries,
        shown: entries.filter(shows).length,
        runOut: entries.filter((item) => item.quantity === 0),
      };
    })
    .filter((group) => group.entries.length > 0);
  const nothingShown = groups.every((group) => group.shown === 0);
  const filtering = needle !== "" || runOutOnly;
  const total = items.length;
  const runOutTotal = items.filter((item) => item.quantity === 0).length;

  if (items.length === 0) return children;

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

      <div className="mt-3 flex min-h-9 items-center justify-between gap-2 px-1">
      <p className="text-sm text-slate-500">
        {say(PANTRY.overview, { count: total })}
        {runOutTotal > 0 && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => setRunOutOnly(true)}
              className="font-medium text-slate-700 underline underline-offset-2"
            >
              {say(PANTRY.overviewRunOut, { count: runOutTotal })}
            </button>
          </>
        )}
      </p>
      {/* Drawn whenever the filter is on rather than only when something has run out:
          the quantities are optimistic, so a control that came and went with the count
          would arrive a beat after the thumb that caused it. Pressed on a full cupboard
          it says so, which is the same answer. */}
      <div className="flex shrink-0 items-center gap-2">
        {runOutOnly ? addToList : cook}
      </div>
      </div>

      <div className="mt-3 space-y-2">
        {groups.map(({ category, entries, shown, runOut }) => {
          const shelf = category ?? "UNSORTED";
          // A search or the switch opens every shelf holding a match — the answer is
          // the rows, and a shut shelf would hide it.
          const open = filtering ? shown > 0 : opened.has(shelf);
          return (
            <section key={shelf} hidden={shown === 0} data-shelf={shelf}>
              <Card padded={false} className="overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(shelf)}
                    aria-expanded={open}
                    data-shelf-toggle
                    className="pressable flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className={`mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-(--fold-ms) ease-(--fold-ease) ${open ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-slate-800">{shelfName(category)}</span>
                        <span className="text-sm text-slate-400 tabular-nums">{shown}</span>
                        {runOut.length > 0 && (
                          <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {say(PANTRY.overviewRunOut, { count: runOut.length })}
                          </span>
                        )}
                      </span>
                      <ShelfPreview open={!open}>{entries.map((entry) => entry.name).join(", ")}</ShelfPreview>
                    </span>
                  </button>
                  {category === null && (
                    <PantrySortButton asksAi={entries.some((entry) => !lookupGood(entry.name))} />
                  )}
                </div>
                {/* Shut is hidden, never unmounted: a row may be holding an optimistic
                    quantity or name on its way to the server. */}
                <ShelfFold open={open}>
                  <div
                    className="border-t border-slate-100 [&>:not([hidden])~:not([hidden])]:border-t [&>:not([hidden])~:not([hidden])]:border-slate-100"
                  >
                    {entries.map((item) => (
                      <div key={item.id} hidden={!shows(item)}>
                        <PantryRow
                          id={item.id}
                          name={item.name}
                          quantity={item.quantity}
                          unit={item.unit}
                          category={item.category}
                          expiresOn={item.expiresOn}
                          photoId={item.photoId}
                          expiresIn={item.expiresIn}
                        />
                      </div>
                    ))}
                  </div>
                </ShelfFold>
              </Card>
            </section>
          );
        })}
      </div>
    </>
  );
}

/** A shelf's rows, folding open and shut — hidden once shut, never unmounted. */
function ShelfFold({ open, children }: { open: boolean; children: React.ReactNode }) {
  const fold = useFold(open);
  return (
    <div hidden={!fold.shown} className={fold.className} style={fold.style}>
      {/* The grid item: bare, because a border or padding here is the height it cannot
          fold below, left as a pixel's snap when the fold lands. */}
      <div>{children}</div>
    </div>
  );
}

/**
 * A shut shelf's names on one line, folding away as the rows fold in and back as they
 * fold out. Dropped in one frame it took a line off the heading the instant the shelf
 * was pressed — a jump before the rows had even begun to move — and the two folds share
 * one easing, so together the card grows and shrinks in one movement.
 */
function ShelfPreview({ open, children }: { open: boolean; children: React.ReactNode }) {
  const fold = useFold(open);
  if (!fold.shown) return null;
  return (
    <span className={`block ${fold.className}`} style={fold.style}>
      <span className="block">
        <span className="block truncate pt-0.5 text-xs text-slate-500">{children}</span>
      </span>
    </span>
  );
}
