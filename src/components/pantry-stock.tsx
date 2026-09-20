"use client";

import { useOptimistic, useTransition } from "react";
import { setPantryStock } from "@/app/actions/pantry";
import { tick } from "@/lib/haptics";

/**
 * One basic good, and whether the household has it.
 *
 * The box and the name are one control rather than a box with a label beside it: this is
 * pressed while standing at an open cupboard door, and a five-millimetre target for a
 * yes-or-no question is a question that gets answered wrong. Editing and deleting stay
 * behind the three dots at the other end of the row, where a thumb aiming at "we're out
 * of rice" cannot reach them.
 *
 * It fills the moment it is pressed rather than when the server answers, for the reason
 * the star on a list does: this is a passing thought on the way somewhere else, and a
 * control that waits half a second to admit it heard you gets pressed twice. The write
 * is told the state to land in rather than "the other one", so the second press of a
 * double tap leaves the cupboard saying what the thumb meant.
 *
 * `role="checkbox"` rather than a pressed button: "in stock" is a state this row is in,
 * not an action the row does, and a screen reader saying "Rice, checked" is the sentence
 * somebody is actually looking for.
 */
export function PantryStock({
  id,
  name,
  inStock,
}: {
  id: string;
  name: string;
  inStock: boolean;
}) {
  const [stocked, setStocked] = useOptimistic(inStock);
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

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={stocked}
      onClick={toggle}
      className="pressable flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1.5 text-left transition-colors hover:bg-slate-50 active:scale-[0.99]"
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
          stocked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {stocked ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      {/* Only the half that is worth interrupting the page for. Having something in is
          the ordinary state of a cupboard and says itself through the tick; having run
          out is the thing somebody wants to spot while scanning the column, and it is
          also the thing that will put the line back on the shopping. */}
      {!stocked && <span className="shrink-0 text-xs text-slate-500">Run out</span>}
    </button>
  );
}
