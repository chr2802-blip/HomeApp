"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { HomeLanguage, PantryCategory, PantryUnit } from "@prisma/client";
import {
  deletePantryItem,
  editPantryItem,
  renamePantryItem,
  setPantryQuantity,
} from "@/app/actions/pantry";
import { ItemMenu } from "@/components/item-menu";
import { PantryQuantityField } from "@/components/pantry-quantity-field";
import { tick } from "@/lib/haptics";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { PANTRY, PANTRY_CATEGORY_LABELS, PANTRY_UNIT_LABELS } from "@/lib/copy/pantry";
import { PANTRY_CATEGORIES, PANTRY_UNITS } from "@/lib/pantry";

/**
 * One basic good: how much the household has of it, what it is counted in, what it is
 * called, and the way to drop it.
 *
 * **The state is a quantity, not a tick.** Zero is "we've run out" and anything past
 * that is "we have it" — the same bit a switch used to carry, now a number a household
 * can actually read off the shelf: "500 g", "2 dåser".
 *
 * It moves the moment it is pressed rather than when the server answers, for the reason
 * the star on a list does: this is a passing thought on the way somewhere else, and a
 * control that waits half a second to admit it heard you gets pressed twice. The write
 * is told the quantity to land in rather than "one more/one less", so the same press
 * arriving twice — a double tap, a retry — leaves the cupboard saying what the thumb
 * meant.
 *
 * **The name is edited by pressing it**, exactly as a list item's is — a name is the one
 * thing on a row worth changing without a trip to a sheet, and a rename that costs a
 * menu, a dialog and a Save is a rename nobody makes. Delete keeps the three dots to
 * itself: a destructive entry is the whole reason that menu exists, and it stays at the
 * far end of the row where a thumb aiming at "we're out of rice" cannot reach it.
 */
export function PantryRow({
  id,
  name,
  quantity,
  unit,
  category,
}: {
  id: string;
  name: string;
  quantity: number;
  unit: PantryUnit | null;
  category: PantryCategory | null;
}) {
  const [stock, setStock] = useOptimistic(quantity);
  /*
   * The name shown, which leads the stored one while a rename is in flight. A refused
   * rename — the household already keeps something under that name — needs no undoing:
   * the optimistic value falls back to what is stored the moment the transition ends,
   * so the row goes back to saying what it says, and `error` is why.
   */
  const [shown, setShown] = useOptimistic(name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const language = useLanguage();
  const say = sayIn(language);

  function changeStock(nextQuantity: number) {
    const data = new FormData();
    data.set("pantryItemId", id);
    data.set("quantity", String(nextQuantity));

    tick();
    startTransition(async () => {
      setStock(nextQuantity);
      await setPantryQuantity(data);
    });
  }

  function open() {
    setDraft(shown);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const text = draft.trim();
    // Blank is not a name, and neither is the name it already has. The row already
    // carries the only wording there is, so the editor falls back to that rather than
    // asking for the press again.
    if (!text || text === shown) return;

    const data = new FormData();
    data.set("pantryItemId", id);
    data.set("name", text);

    startTransition(async () => {
      setShown(text);
      const outcome = await renamePantryItem(data);
      setError(outcome?.ok === false ? outcome.error : null);
    });
  }

  return (
    // The id is what the add box scrolls to and washes when it says "already in the
    // pantry — show it".
    <div id={`pantry-${id}`} className="scroll-mt-24 px-4 py-2">
      <div className="flex items-center gap-1">
        <PantryQuantityField
          quantity={stock}
          unit={unit}
          onChange={changeStock}
          label={shown}
          language={language}
        />

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              // Enter saves and Escape reverts, the same two keys the list's own
              // editor answers to — blurring is what actually commits, so Enter only
              // has to leave the field.
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraft(shown);
                setEditing(false);
              }
            }}
            aria-label={say(PANTRY.editAria, { name: shown })}
            className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus-visible:border-slate-500"
          />
        ) : (
          <button
            type="button"
            onClick={open}
            aria-label={say(PANTRY.editAria, { name: shown })}
            className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm transition-colors hover:bg-slate-50"
          >
            {shown}
          </button>
        )}

        {/* Only the half worth interrupting the page for. Having something in is the
            ordinary state of a cupboard and the quantity already says it; having run
            out is what somebody scans the column for, and it names exactly what "Add
            to list" at the top of the page will take. */}
        {stock === 0 && (
          <span className="shrink-0 text-xs text-slate-500">{say(PANTRY.runOut)}</span>
        )}

        <ItemMenu
          name="pantryItemId"
          id={id}
          label={shown}
          editAction={editPantryItem}
          editTitle={say(PANTRY.editTitle)}
          editLabel={say(PANTRY.editEntry)}
          deleteAction={deletePantryItem}
          deleteTitle={say(PANTRY.removeTitle)}
          deleteMessage={say(PANTRY.removeMessage, { name: shown })}
          deleteConfirmLabel={say(PANTRY.removeConfirm)}
          className="-mr-2"
        >
          <PantryEditFields category={category} unit={unit} language={language} />
        </ItemMenu>
      </div>

      {/* Under the row rather than in a sheet, because the row is where the rename was
          typed — and a live region, since nothing moved when the answer arrived. */}
      {error && (
        <p role="alert" className="mt-1 pl-14 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The sheet's two questions, as two groups of chips: which shelf, and what it is counted
 * in. Radios rather than two `<select>`s, because both lists are short enough to read
 * whole, and a sheet has the room that a row did not.
 *
 * An unsorted entry opens with no shelf chosen — "not sorted yet" is where nobody has
 * decided, and a sheet that pre-ticked "Other" would decide it on the household's behalf
 * the moment somebody only meant to change the unit. "No unit" is a choice like any other.
 *
 * Takes `language` rather than reaching for the context, like `AmountsField` — see
 * CLAUDE.md on components with no boundary of their own.
 */
export function PantryEditFields({
  category,
  unit,
  language,
}: {
  category: PantryCategory | null;
  unit: PantryUnit | null;
  language: HomeLanguage;
}) {
  const say = sayIn(language);
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{say(PANTRY.categoryLabel)}</legend>
        <div className="flex flex-wrap gap-2">
          {PANTRY_CATEGORIES.map((value) => (
            <Chip key={value} name="category" value={value} defaultChecked={category === value}>
              {say(PANTRY_CATEGORY_LABELS[value])}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{say(PANTRY.unitLabel)}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip name="unit" value="" defaultChecked={unit === null}>
            {say(PANTRY.noUnit)}
          </Chip>
          {PANTRY_UNITS.map((value) => (
            <Chip key={value} name="unit" value={value} defaultChecked={unit === value}>
              {say(PANTRY_UNIT_LABELS[value])}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** One radio, drawn as a pill in the home's own colour when it is the one chosen. */
function Chip({
  name,
  value,
  defaultChecked,
  children,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="pressable inline-block rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-1">
        {children}
      </span>
    </label>
  );
}
