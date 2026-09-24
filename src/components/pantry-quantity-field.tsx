"use client";

import { useState } from "react";
import type { HomeLanguage, PantryUnit } from "@prisma/client";
import { ContextMenu, MenuItem } from "@/components/context-menu";
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
 * The unit picker is `ContextMenu`, not a bare `<select>`: a native select sizes its
 * closed box to its *widest possible option* rather than what it is showing, so
 * offering "Bunch"/"None" made every row's box as wide as those words even while
 * showing "g" — which is what left no room for the name beside it. `ContextMenu`'s
 * trigger is exactly as wide as whatever unit this one row is actually showing, so most
 * rows stay narrow and only a row genuinely set to a longer word spends the space.
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
  const unitLabel = unit ? say(PANTRY_UNIT_LABELS[unit]) : say(PANTRY.noUnit);

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
          className="w-7 [appearance:textfield] border-0 bg-transparent p-0 text-center text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

      <ContextMenu
        label={say(PANTRY.unitAria, { name: label, value: unitLabel })}
        triggerLabel={say(PANTRY.unitAria, { name: label, value: unitLabel })}
        className="pressable flex h-9 items-center gap-0.5 rounded-lg border border-slate-300 bg-white pr-1.5 pl-2 text-sm text-slate-700 hover:bg-slate-50"
        trigger={
          <>
            {/* The dash is a placeholder glyph, not a word, so it needs no language of
                its own — the same reason "−"/"+" beside it are written plainly. The
                accessible name above carries the real value ("No unit") instead, since
                a screen reader has no use for a visually compact placeholder. */}
            <span className="max-w-20 truncate">{unit ? unitLabel : "–"}</span>
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
        <MenuItem onSelect={() => onChange(quantity, null)}>
          <UnitCheck checked={unit === null} />
          {say(PANTRY.noUnit)}
        </MenuItem>
        {PANTRY_UNITS.map((value) => (
          <MenuItem key={value} onSelect={() => onChange(quantity, value)}>
            <UnitCheck checked={unit === value} />
            {say(PANTRY_UNIT_LABELS[value])}
          </MenuItem>
        ))}
      </ContextMenu>
    </div>
  );
}

/** Which unit is already chosen, marked the way a native `<select>` marks it in its own
 *  dropdown — `ContextMenu`'s panel has no notion of a "current" entry otherwise. */
function UnitCheck({ checked }: { checked: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      {checked && <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
