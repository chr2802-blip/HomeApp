"use client";

import { useState } from "react";
import type { HomeLanguage, PantryUnit } from "@prisma/client";
import { MAX_PANTRY_QUANTITY, PANTRY_UNITS, clampPantryQuantity } from "@/lib/pantry";
import { sayIn } from "@/lib/copy/say";
import { PANTRY, PANTRY_UNIT_LABELS } from "@/lib/copy/pantry";

/**
 * How much of a basic good the household has, and what it is counted in — the pantry's
 * own quantity picker, replacing the switch a pantry row used to carry.
 *
 * Zero is the stepper's ordinary floor here rather than out-of-range input to correct
 * away from: it is the pantry's own "run out", what `inStock: false` used to mean. The
 * unit is offered only from `PANTRY_UNITS`, and "no unit" is its own choice — a plain
 * count ("3") is as valid an answer as a measured one ("500 g"), the same reason a
 * counted recipe ingredient carries no unit either.
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
  onChange: (quantity: number, unit: PantryUnit | null) => void;
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
    if (clamped !== quantity) onChange(clamped, unit);
  }

  const step = (by: number) => () => commit(quantity + by);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div
        role="group"
        aria-label={say(PANTRY.quantityAria, { name: label })}
        className="flex items-center rounded-lg border border-slate-300 bg-white"
      >
        <button
          type="button"
          onClick={step(-1)}
          disabled={quantity <= 0}
          aria-label={say(PANTRY.decreaseQuantity, { name: label })}
          className="pressable h-9 w-6 rounded-l-lg text-slate-600 hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
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
          className="w-6 [appearance:textfield] border-0 bg-transparent p-0 text-center text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={step(1)}
          disabled={quantity >= MAX_PANTRY_QUANTITY}
          aria-label={say(PANTRY.increaseQuantity, { name: label })}
          className="pressable h-9 w-6 rounded-r-lg text-slate-600 hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
        >
          +
        </button>
      </div>

      <select
        value={unit ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          onChange(quantity, value === "" ? null : (value as PantryUnit));
        }}
        aria-label={say(PANTRY.unitAria, { name: label })}
        // A bare `<select>` sizes itself to its widest *option*, not its shown value —
        // so "Ingen enhed" made every row's box the same width as its own, whatever it
        // was showing. Fixed and truncated instead: the name beside it is what a
        // household is actually scanning the column for.
        className="h-9 w-12 shrink-0 truncate rounded-lg border border-slate-300 bg-white pl-1 text-sm text-slate-700 outline-none focus-visible:border-slate-500"
      >
        <option value="">{say(PANTRY.noUnit)}</option>
        {PANTRY_UNITS.map((value) => (
          <option key={value} value={value}>
            {say(PANTRY_UNIT_LABELS[value])}
          </option>
        ))}
      </select>
    </div>
  );
}
