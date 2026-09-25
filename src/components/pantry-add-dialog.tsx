"use client";

import { useState, useTransition } from "react";
import type { PantryCategory } from "@prisma/client";
import { createPantryItem, sortPantry } from "@/app/actions/pantry";
import { IconButton, Input, Label } from "@/components/ui";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { Chip } from "@/components/pantry-row";
import { showPantryRow } from "@/components/pantry-shelves";
import { useLanguage } from "@/components/language-provider";
import { PANTRY_CATEGORIES, pantryKey } from "@/lib/pantry";
import { goodsMatching, lookupGood } from "@/lib/pantry-goods";
import type { FormAction } from "@/lib/action-result";
import { sayIn } from "@/lib/copy/say";
import { PANTRY, PANTRY_CATEGORY_LABELS } from "@/lib/copy/pantry";

/** What the add sheet knows about an entry already kept, to point at it rather than add it twice. */
export type KeptEntry = { id: string; name: string; key: string };

const MAX_KEPT = 4;
const MAX_GOODS = 5;

/**
 * Adding to the pantry the way everything else in the app is added: the green "+" beside
 * the page's title, and a sheet — the same `IconButton` `create` and `DialogForm` the
 * lists and tasks pages use through `FormDialog`. Written out here rather than through
 * `FormDialog` because this sheet has two things that one does not: its fields read the
 * name as it is typed, and a successful add may have one more thing to send afterwards.
 *
 * **What the sheet asks.** A name, and which shelf — as chips, the way the "Shelf and
 * unit" sheet asks it, starting on "choose for me", which says which shelf that will be
 * where `lookupGood` knows the name. The same lookup `createPantryItem` makes, so the
 * preview and the save cannot disagree.
 *
 * **"You already have that."** As the name is typed, the entries already kept that it
 * could be are offered first, under their own heading. Picking one adds nothing: it closes
 * the sheet and asks `PantryShelves` to show the row (clearing any filter hiding it),
 * because somebody typing "ris" almost always meant "is the rice in". A name whose key is
 * exactly one already kept says so before the press. **"Did you mean one of these."** Then
 * common basics not yet kept, in the household's language; picking one fills the name.
 * The suggestions sit in the sheet's own flow rather than floating over it, because the
 * sheet's body scrolls and would clip a list drawn outside it.
 *
 * **Nothing waits on AI.** A name the list does not know is stored unsorted, and once the
 * add has answered, `sortPantry` is sent without waiting: the row appears under "Not sorted
 * yet" and moves onto its shelf when the model has answered. So there is no `AiOverlay`.
 */
export function PantryAddDialog({ kept }: { kept: KeptEntry[] }) {
  const say = sayIn(useLanguage());
  const [open, setOpen] = useState(false);
  const [, startSorting] = useTransition();

  // Decided from what was sent, by the same lookup the save made: nothing to sort where
  // the household chose a shelf or the list knew the name.
  const add: FormAction = async (previous, data) => {
    const result = await createPantryItem(previous, data);
    if (result?.ok && !String(data.get("category") ?? "") && !lookupGood(String(data.get("name") ?? ""))) {
      startSorting(async () => void (await sortPantry()));
    }
    return result;
  };

  return (
    <>
      <IconButton variant="create" label={say(PANTRY.add)} onClick={() => setOpen(true)}>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <Modal open={open} onClose={() => setOpen(false)} title={say(PANTRY.add)}>
        <DialogForm
          action={add}
          submitLabel={say(PANTRY.addSubmit)}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        >
          <PantryAddFields
            kept={kept}
            onShow={(id) => {
              setOpen(false);
              showPantryRow(id);
            }}
          />
        </DialogForm>
      </Modal>
    </>
  );
}

/** The sheet's fields. Mounted only while it is open, so every opening starts blank. */
function PantryAddFields({ kept, onShow }: { kept: KeptEntry[]; onShow: (id: string) => void }) {
  const language = useLanguage();
  const say = sayIn(language);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PantryCategory | null>(null);
  const [highlighted, setHighlighted] = useState(-1);

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
  const isOpen = options.length > 0 && !(options.length === 1 && goodMatches[0] === query.trim());

  const known = lookupGood(query);

  function choose(option: Option) {
    setHighlighted(-1);
    if (option.kind === "kept") onShow(option.entry.id);
    else setQuery(option.name);
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
    }
  }

  return (
    <>
      <div className="space-y-1">
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
          }}
          onKeyDown={onKeyDown}
          placeholder={say(PANTRY.namePlaceholder)}
          required
          autoFocus
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="pantry-suggestions"
          aria-autocomplete="list"
        />

        {exact && (
          <p className="pt-1 text-sm text-slate-600">
            {say(PANTRY.alreadyKeptAt, { name: exact.name })}{" "}
            <button
              type="button"
              onClick={() => onShow(exact.id)}
              className="font-medium text-[var(--accent-text)] underline underline-offset-2"
            >
              {say(PANTRY.showIt)}
            </button>
          </p>
        )}

        {isOpen && (
          <div
            id="pantry-suggestions"
            role="listbox"
            aria-label={say(PANTRY.suggestions)}
            className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white"
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

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{say(PANTRY.categoryLabel)}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip name="category" value="" checked={category === null} onChange={() => setCategory(null)}>
            {say(PANTRY.categoryAuto)}
            {known && (
              <span className="opacity-75"> · {say(PANTRY_CATEGORY_LABELS[known.category])}</span>
            )}
          </Chip>
          {PANTRY_CATEGORIES.map((value) => (
            <Chip
              key={value}
              name="category"
              value={value}
              checked={category === value}
              onChange={() => setCategory(value)}
            >
              {say(PANTRY_CATEGORY_LABELS[value])}
            </Chip>
          ))}
        </div>
      </fieldset>
    </>
  );
}
