"use client";

import { useState } from "react";
import type { HomeLanguage } from "@prisma/client";
import { MAX_PANTRY_QUANTITY, clampPantryQuantity } from "@/lib/pantry";
import { sayIn } from "@/lib/copy/say";
import { PANTRY, PANTRY_MEASURE_LABELS } from "@/lib/copy/pantry";

/**
 * How many uses of a basic good the household has — the pantry's own stepper, with "stk"
 * read out beside the number rather than offered as a control. Drawn only for a counted
 * entry; an endless one is a switch on the row (`PantryRow`).
 *
 * Zero is the stepper's ordinary floor here rather than out-of-range input to correct
 * away from: it is the pantry's own "run out".
 *
 * Optimistic the same way `AmountPicker` is, and for the same reason: this is tapped
 * with a thumb on the way past, and a control that waits for the server to agree gets
 * pressed twice.
 */
export function PantryQuantityField({
  quantity,
  onChange,
  label,
  language,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  /** Names the control for a screen reader — "Quantity of Rice". */
  label: string;
  language: HomeLanguage;
}) {
  const say = sayIn(language);
  const written = (value: number) => String(value);
  const [draft, setDraft] = useState(written(quantity));
  const [shown, setShown] = useState(quantity);

  // The quantity can change underneath us — another person's edit arriving, or our own
  // optimistic one landing. Adopting it during render keeps the box honest without an
  // effect that would fight whatever is being typed. Same trick as `AmountPicker`.
  if (quantity !== shown) {
    setShown(quantity);
    setDraft(written(quantity));
  }

  function commit(next: number | string) {
    const clamped = clampPantryQuantity(next);
    setDraft(written(clamped));
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
        className="press-icon h-9 w-7 rounded-l-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
      >
        −
      </button>
      <input
        // Text rather than `number`, so a stray "1,5" is read (and rounded up) rather than
        // answered with "" by a browser whose locale writes a point.
        type="text"
        inputMode="numeric"
        aria-label={say(PANTRY.quantityAria, { name: label })}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        // Two characters' room for the everyday count, widening only past 99, so the
        // name beside it keeps its room on every other row.
        style={{ width: `${Math.max(2, draft.length) + 0.5}ch` }}
        className="border-0 bg-transparent p-0 text-center text-sm tabular-nums outline-none"
      />
      {/* Read, not pressed: "2" says "2 stk". */}
      <span data-testid="pantry-unit" className="pr-0.5 text-xs text-slate-500">
        {say(PANTRY_MEASURE_LABELS.PIECES)}
      </span>
      <button
        type="button"
        onClick={step(1)}
        disabled={quantity >= MAX_PANTRY_QUANTITY}
        aria-label={say(PANTRY.increaseQuantity, { name: label })}
        className="press-icon h-9 w-7 rounded-r-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
      >
        +
      </button>
    </div>
  );
}
