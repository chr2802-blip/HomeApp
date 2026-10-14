"use client";

import { useState } from "react";
import { Modal, ModalBody } from "@/components/modal";

/**
 * Moves a row on a grouped list to another group — a shop's aisle, or one of the list's
 * own categories — in the slot the drag handle holds on an ungrouped list, because a
 * grouped list is ordered by its groups rather than by hand, and this is the one kind of
 * "put it somewhere else" it has.
 *
 * A drawer of chips, like the pantry's shelf picker: one press is the whole answer, so
 * the press closes it.
 */
export function GroupMoveButton<T extends string>({
  label,
  title,
  options,
  current,
  onMove,
}: {
  /** The button's accessible name: "Move milk to another aisle". */
  label: string;
  /** The drawer's question: "Which aisle is milk in?" */
  title: string;
  options: { value: T; label: string }[];
  current: T | null;
  onMove: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        className="press-icon rounded px-2 py-3 text-slate-400 hover:text-slate-700 focus-visible:outline-2"
      >
        {/* Two arrows, up and down: moving the row, not dragging it. */}
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M7 3v14M4 6l3-3 3 3M13 17V3M10 14l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="drawer">
        <ModalBody>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={option.value === current}
                onClick={() => {
                  setOpen(false);
                  if (option.value !== current) onMove(option.value);
                }}
                className={`press-button rounded-full border px-3 py-1.5 text-sm ${
                  option.value === current
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}
