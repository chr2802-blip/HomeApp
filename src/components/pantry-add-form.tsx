"use client";

import { useState, useTransition } from "react";
import type { PantryCategory } from "@prisma/client";
import { createPantryItem, sortPantry } from "@/app/actions/pantry";
import { Button, Input, Label } from "@/components/ui";
import { ContextMenu, MenuItem } from "@/components/context-menu";
import { useFormAction } from "@/components/use-form-action";
import { showPantryRow } from "@/components/pantry-shelves";
import { useLanguage } from "@/components/language-provider";
import { PANTRY_CATEGORIES, pantryKey } from "@/lib/pantry";
import { goodsMatching, lookupGood } from "@/lib/pantry-goods";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { PANTRY, PANTRY_CATEGORY_LABELS } from "@/lib/copy/pantry";

/** What the add box knows about an entry already kept, to point at it rather than add it twice. */
export type KeptEntry = { id: string; name: string; key: string };

const MAX_KEPT = 4;
const MAX_GOODS = 5;

/**
 * The pantry's add box: a name, which shelf it goes on, and — as the name is typed — the
 * two things a household adding to its cupboard most needs to be told.
 *
 * **"You already have that."** The entries this pantry already keeps that the name could
 * be, first, under their own heading. Picking one does not add anything: it asks
 * `PantryShelves` to show the row (clearing any filter hiding it) and wash it in the
 * home's colour, because somebody typing "ris" into the add box
 * almost always meant "is the rice in", and the answer — and the stepper to change it — is
 * on that row. A name whose key is exactly one already kept says so under the box before
 * the press rather than after it.
 *
 * **"Did you mean one of these."** Then common basics from `pantry-goods.ts` this pantry
 * does not keep yet, written in the household's language. Picking one only fills the name.
 *
 * The shelf picker starts on "choose for me", and says which shelf that will be where
 * `lookupGood` knows the name — the same lookup `createPantryItem` makes, so the preview
 * and the save cannot disagree. A name it does not know is stored unsorted, and once the
 * add has answered this sends `sortPantry` without waiting for it: the row appears at
 * once under "Not sorted yet" and moves onto its shelf when the model has answered. So
 * nothing here waits on AI, and there is no `AiOverlay` to draw.
 *
 * Filtered on the client, like the list's own add box: everything it matches against is
 * already on the page.
 */
export function PantryAddForm({ kept }: { kept: KeptEntry[] }) {
  const language = useLanguage();
  const say = sayIn(language);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PantryCategory | null>(null);
  const [highlighted, setHighlighted] = useState(-1);
  // Open only while the name is being typed: left open after the field is let go, the
  // list sits over the shelf picker and the Add button it was never about.
  const [typing, setTyping] = useState(false);
  const [, startSorting] = useTransition();

  const { state, pending, handleSubmit } = useFormAction(createPantryItem, {
    onSuccess: (form) => {
      // Decided from what was sent, by the same lookup the save made: nothing to sort
      // where the household chose a shelf or the list knew the name.
      const sent = query;
      if (!category && !lookupGood(sent)) startSorting(async () => void (await sortPantry()));
      form.reset();
      setQuery("");
      setCategory(null);
      setHighlighted(-1);
    },
  });

  const needle = query.trim().toLowerCase();
  const key = pantryKey(query);
  const keptKeys = new Set(kept.map((entry) => entry.key));

  const exact = key ? kept.find((entry) => entry.key === key) : undefined;
  const keptMatches = needle
    ? kept
        .filter((entry) => entry.name.toLowerCase().includes(needle) || (key && entry.key.includes(key)))
        .slice(0, MAX_KEPT)
    : [];
  const goodMatches = goodsMatching(query, language, MAX_GOODS + keptMatches.length)
    .filter((name) => !keptKeys.has(pantryKey(name)))
    .slice(0, MAX_GOODS);

  type Option = { kind: "kept"; entry: KeptEntry } | { kind: "good"; name: string };
  const options: Option[] = [
    ...keptMatches.map((entry) => ({ kind: "kept" as const, entry })),
    ...goodMatches.map((name) => ({ kind: "good" as const, name })),
  ];
  // A single suggestion that is exactly what was typed has nothing left to offer.
  const isOpen =
    typing && options.length > 0 && !(options.length === 1 && goodMatches[0] === query.trim());

  const known = lookupGood(query);
  const shelf = category ?? known?.category ?? null;
  const shelfText = shelf ? say(PANTRY_CATEGORY_LABELS[shelf]) : say(PANTRY.categoryAuto);

  function show(entry: KeptEntry) {
    setQuery("");
    setHighlighted(-1);
    showPantryRow(entry.id);
  }

  function choose(option: Option) {
    if (option.kind === "kept") show(option.entry);
    else {
      setQuery(option.name);
      setHighlighted(-1);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((current) => (current + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" && highlighted >= 0) {
      event.preventDefault();
      choose(options[highlighted]!);
      return;
    }
    if (event.key === "Escape") {
      setHighlighted(-1);
      setQuery("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="category" value={category ?? ""} />
      <div className="relative space-y-1">
        <Label htmlFor="pantry-name">{say(PANTRY.nameLabel)}</Label>
        {/* One thing per entry, written the way it would go on a shopping list: that is
            what it is matched against. "Salt and pepper" is two entries. */}
        <Input
          id="pantry-name"
          name="name"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(-1);
            setTyping(true);
          }}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          onKeyDown={onKeyDown}
          placeholder={say(PANTRY.namePlaceholder)}
          required
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="pantry-suggestions"
          aria-autocomplete="list"
        />

        {isOpen && (
          <div
            id="pantry-suggestions"
            role="listbox"
            aria-label={say(PANTRY.suggestions)}
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            {keptMatches.length > 0 && (
              <p className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">{say(PANTRY.alreadyKept)}</p>
            )}
            {options.map((option, index) => {
              const first = option.kind === "good" && index === keptMatches.length;
              return (
                <div key={option.kind === "kept" ? option.entry.id : option.name}>
                  {first && (
                    <p className="border-y border-slate-100 px-3 py-1.5 text-xs text-slate-500">
                      {say(PANTRY.commonGoods)}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      index === highlighted ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span aria-hidden="true" className="text-slate-400">
                      {option.kind === "kept" ? "↓" : "+"}
                    </span>
                    {option.kind === "kept" ? option.entry.name : option.name}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {exact && (
        <p className="text-sm text-slate-600">
          {say(PANTRY.alreadyKeptAt, { name: exact.name })}{" "}
          <button
            type="button"
            onClick={() => show(exact)}
            className="font-medium text-[var(--accent-text)] underline underline-offset-2"
          >
            {say(PANTRY.showIt)}
          </button>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ContextMenu
          label={say(PANTRY.categoryAria, { value: shelfText })}
          triggerLabel={say(PANTRY.categoryAria, { value: shelfText })}
          className="pressable flex h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          trigger={
            <>
              <span className="text-slate-500">{say(PANTRY.categoryLabel)}:</span>
              <span className={category ? "" : "text-slate-500 italic"}>{shelfText}</span>
              <svg
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          }
        >
          <MenuItem onSelect={() => setCategory(null)}>{say(PANTRY.categoryAuto)}</MenuItem>
          {PANTRY_CATEGORIES.map((value) => (
            <MenuItem key={value} onSelect={() => setCategory(value)}>
              {say(PANTRY_CATEGORY_LABELS[value])}
            </MenuItem>
          ))}
        </ContextMenu>

        <Button type="submit" disabled={pending} aria-busy={pending}>
          {say(PANTRY.add)}
        </Button>
        {state?.ok === false && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state?.ok && <p className="text-sm text-emerald-700">{say(APP.added)}</p>}
      </div>
    </form>
  );
}
