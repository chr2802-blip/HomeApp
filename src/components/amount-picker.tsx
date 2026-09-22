"use client";

import { useState } from "react";
import { MAX_AMOUNT, MIN_AMOUNT, clampAmount } from "@/lib/amount";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

/**
 * How many of an item are wanted: minus, a box, plus.
 *
 * The buttons are the main way in — this is tapped with a thumb while standing in a
 * shop — but the box takes a typed number too, because reaching 12 by tapping is not a
 * feature. Typing is committed on blur or Enter rather than on every keystroke, so
 * "12" does not travel to the server as 1 and then 12.
 */
export function AmountPicker({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: number;
  onChange: (amount: number) => void;
  /** Names the control for a screen reader — "Amount", or "Amount for Milk" on a row. */
  label: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  const say = sayIn(useLanguage());

  // The amount can change underneath us — another person's edit arriving, or our own
  // optimistic one landing. Adopting it during render keeps the box honest without an
  // effect that would fight whatever is being typed.
  if (value !== shown) {
    setShown(value);
    setDraft(String(value));
  }

  function commit(next: number) {
    const amount = clampAmount(next);
    setDraft(String(amount));
    if (amount !== value) onChange(amount);
  }

  const step = (by: number) => () => commit(value + by);

  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center rounded-lg border border-slate-300 bg-white"
    >
      <button
        type="button"
        onClick={step(-1)}
        disabled={disabled || value <= MIN_AMOUNT}
        aria-label={say(LISTS.decrease, { name: label })}
        className="pressable h-9 w-6 rounded-l-lg text-slate-600 hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={draft}
        min={MIN_AMOUNT}
        max={MAX_AMOUNT}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(Number(draft))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        // The spinners are tiny, sit where the thumb already is, and duplicate the two
        // buttons either side of them.
        className="w-7 [appearance:textfield] sm:w-9 border-0 bg-transparent p-0 text-center text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={step(1)}
        disabled={disabled || value >= MAX_AMOUNT}
        aria-label={say(LISTS.increase, { name: label })}
        className="pressable h-9 w-6 rounded-r-lg text-slate-600 hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent sm:w-8"
      >
        +
      </button>
    </div>
  );
}
