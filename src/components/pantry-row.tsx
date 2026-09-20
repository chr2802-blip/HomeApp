"use client";

import { useOptimistic, useState, useTransition } from "react";
import { deletePantryItem, renamePantryItem, setPantryStock } from "@/app/actions/pantry";
import { ItemMenu } from "@/components/item-menu";
import { tick } from "@/lib/haptics";

/**
 * One basic good: whether the household has it, what it is called, and the way to drop
 * it.
 *
 * **The state is a switch, not a tick.** A checkbox says "this one is selected" — a
 * thing picked out of a list on the way to doing something with it, which is what a
 * shopping list's boxes mean. This is not that: it is a standing fact about the
 * cupboard, on or off until somebody changes it, and a switch is what that looks like
 * in every app a phone already has.
 *
 * It moves the moment it is pressed rather than when the server answers, for the reason
 * the star on a list does: this is a passing thought on the way somewhere else, and a
 * control that waits half a second to admit it heard you gets pressed twice. The write
 * is told the state to land in rather than "the other one", so the second press of a
 * double tap leaves the cupboard saying what the thumb meant.
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
  inStock,
}: {
  id: string;
  name: string;
  inStock: boolean;
}) {
  const [stocked, setStocked] = useOptimistic(inStock);
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

  function toggle() {
    const data = new FormData();
    data.set("pantryItemId", id);
    data.set("inStock", stocked ? "false" : "true");

    tick();
    startTransition(async () => {
      setStocked(!stocked);
      await setPantryStock(data);
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
    <div className="px-4 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={stocked}
          // Named for the state rather than the press: a screen reader says "Rice, on"
          // rather than renaming the control under the person using it.
          aria-label={shown}
          title={stocked ? `${shown} is in` : `${shown} has run out`}
          onClick={toggle}
          className={`pressable relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition active:scale-95 ${
            // The home's own colour: this is a control, and a control is exactly what
            // the accent dresses. Grey off, because off is the absence of the state
            // rather than a second one.
            stocked ? "bg-[var(--accent)]" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-5 w-5 rounded-full bg-white shadow transition ${
              stocked ? "translate-x-[1.375rem]" : "translate-x-0.5"
            }`}
          />
        </button>

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
            aria-label={`Edit ${shown}`}
            className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus-visible:border-slate-500"
          />
        ) : (
          <button
            type="button"
            onClick={open}
            aria-label={`Edit ${shown}`}
            className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm transition-colors hover:bg-slate-50"
          >
            {shown}
          </button>
        )}

        {/* Only the half worth interrupting the page for. Having something in is the
            ordinary state of a cupboard and the switch says it; having run out is what
            somebody scans the column for, and it names exactly what "Add to list" at
            the top of the page will take. */}
        {!stocked && <span className="shrink-0 text-xs text-slate-500">Run out</span>}

        <ItemMenu
          name="pantryItemId"
          id={id}
          label={shown}
          deleteAction={deletePantryItem}
          deleteTitle="Remove from pantry"
          deleteMessage={`Stop treating “${shown}” as something you always have in? Recipes asking for it will put it on the shopping list again.`}
          deleteConfirmLabel="Remove"
          className="-mr-2"
        />
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
