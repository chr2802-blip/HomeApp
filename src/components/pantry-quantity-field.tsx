"use client";

import { useState } from "react";
import type { HomeLanguage, PantryUnit } from "@prisma/client";
import { MAX_PANTRY_QUANTITY, clampPantryQuantity } from "@/lib/pantry";
import { sayIn } from "@/lib/copy/say";
import { PANTRY, PANTRY_UNIT_LABELS } from "@/lib/copy/pantry";

/**
 * How much of a basic good the household has — the pantry's own stepper, with the unit
 * it is counted in read out beside the number ("2 kg") rather than offered as a control.
 *
 * Zero is the stepper's ordinary floor here rather than out-of-range input to correct
 * away from: it is the pantry's own "run out", what `inStock: false` used to mean.
 *
 * **The unit is not chosen here any more.** It used to be a menu on every row, and a
 * control on every row is room taken from the name on every row — for a thing that is
 * set once, when the entry is new, and then left alone. So it moved into the sheet
 * behind the three dots beside the shelf (`editPantryItem`), and the row only says it.
 * The quantity is what changes on a Tuesday; that is what stays under the thumb.
 *
 * Optimistic the same way `AmountPicker` is, and for the same reason: this is tapped
 * with a thumb on the way past, and a control that waits for the server to agree gets
 * pressed twice.
 */
export function PantryQuantityField({
  quantity,
  unit,
  onChange,
  label,
  language,
}: {
  quantity: number;
  unit: PantryUnit | null;
  onChange: (quantity: number) => void;
  /** Names the control for a screen reader — "Quantity of Rice". */
  label: string;
  language: HomeLanguage;
}) {
  const say = sayIn(language);
  const [draft, setDraft] = useState(String(quantity));
  const [shown, setShown] = useState(quantity);

  // The quantity can change underneath us — another person's edit arriving, or our own
  // optimistic one landing. Adopting it during render keeps the box honest without an
  // effect that would fight whatever is being typed. Same trick as `AmountPicker`.
  if (quantity !== shown) {
    setShown(quantity);
    setDraft(String(quantity));
  }

  function commit(next: number) {
    const clamped = clampPantryQuantity(next);
    setDraft(String(clamped));
    if (clamped !== quantity) onChange(clamped);
  }

  const step = (by: number) => () => commit(quantity + by);

  return (
    <div
      role="group"
      aria-label={say(PANTRY.quantityAria, { name: label })}
      className="flex shrink-0 items-center rounded-lg border border-slate-300 bg-white"
    >
      <button
        type="button"
        onClick={step(-1)}
        disabled={quantity <= 0}
        aria-label={say(PANTRY.decreaseQuantity, { name: label })}
        className="pressable h-9 w-7 rounded-l-lg text-slate-600 hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={say(PANTRY.quantityAria, { name: label })}
        value={draft}
        min={0}
        max={MAX_PANTRY_QUANTITY}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(Number(draft))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        // The spinners are tiny, sit where the thumb already is, and duplicate the
        // two buttons either side of them.
        className="w-7 [appearance:textfield] border-0 bg-transparent p-0 text-center text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {/* Read, not pressed: the number's own unit, so "2" says "2 kg". Nothing is drawn
          for a plain count, which is the commonest entry and needs no word. */}
      {unit && (
        <span data-testid="pantry-unit" className="pr-0.5 text-xs text-slate-500">
          {say(PANTRY_UNIT_LABELS[unit])}
        </span>
      )}
      <button
        type="button"
        onClick={step(1)}
        disabled={quantity >= MAX_PANTRY_QUANTITY}
        aria-label={say(PANTRY.increaseQuantity, { name: label })}
        className="pressable h-9 w-7 rounded-r-lg text-slate-600 hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
      >
        +
      </button>
    </div>
  );
}
