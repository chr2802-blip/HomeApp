"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { PantryUnit } from "@prisma/client";
import { deletePantryItem, renamePantryItem, setPantryQuantity } from "@/app/actions/pantry";
import { ItemMenu } from "@/components/item-menu";
import { PantryQuantityField } from "@/components/pantry-quantity-field";
import { tick } from "@/lib/haptics";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { PANTRY } from "@/lib/copy/pantry";

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
}: {
  id: string;
  name: string;
  quantity: number;
  unit: PantryUnit | null;
}) {
  const [stock, setStock] = useOptimistic({ quantity, unit });
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

  function changeStock(nextQuantity: number, nextUnit: PantryUnit | null) {
    const data = new FormData();
    data.set("pantryItemId", id);
    data.set("quantity", String(nextQuantity));
    data.set("unit", nextUnit ?? "");

    tick();
    startTransition(async () => {
      setStock({ quantity: nextQuantity, unit: nextUnit });
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
    <div className="px-4 py-2">
      <div className="flex items-center gap-3">
        <PantryQuantityField
          quantity={stock.quantity}
          unit={stock.unit}
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
        {stock.quantity === 0 && (
          <span className="shrink-0 text-xs text-slate-500">{say(PANTRY.runOut)}</span>
        )}

        <ItemMenu
          name="pantryItemId"
          id={id}
          label={shown}
          deleteAction={deletePantryItem}
          deleteTitle={say(PANTRY.removeTitle)}
          deleteMessage={say(PANTRY.removeMessage, { name: shown })}
          deleteConfirmLabel={say(PANTRY.removeConfirm)}
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
