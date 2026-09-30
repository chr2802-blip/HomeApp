"use client";

import { useState } from "react";
import type { ShopAisle } from "@prisma/client";
import { Modal, ModalBody } from "@/components/modal";
import { useLanguage } from "@/components/language-provider";
import { SHOP_AISLES } from "@/lib/shop-goods";
import { sayIn } from "@/lib/copy/say";
import { LISTS, SHOP_AISLE_LABELS } from "@/lib/copy/lists";

/**
 * Moves a row on a list grouped by aisle to another aisle — in the slot the drag handle
 * holds on an ungrouped list, because a grouped list is ordered by the shop rather than
 * by hand, and this is the one kind of "put it somewhere else" it has.
 *
 * A drawer of chips, like the pantry's shelf picker: one press is the whole answer, so
 * the press closes it.
 */
export function AisleMoveButton({
  name,
  current,
  onMove,
}: {
  name: string;
  current: ShopAisle | null;
  onMove: (aisle: ShopAisle) => void;
}) {
  const say = sayIn(useLanguage());
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={say(LISTS.moveAisle, { name })}
        title={say(LISTS.moveAisle, { name })}
        aria-haspopup="dialog"
        className="pressable rounded px-2 py-3 text-slate-400 hover:text-slate-700 focus-visible:outline-2"
      >
        {/* Two arrows, up and down: moving the row, not dragging it. */}
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M7 3v14M4 6l3-3 3 3M13 17V3M10 14l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={say(LISTS.whichAisle, { name })} size="drawer">
        <ModalBody>
          <div className="flex flex-wrap gap-2">
            {SHOP_AISLES.map((aisle) => (
              <button
                key={aisle}
                type="button"
                aria-pressed={aisle === current}
                onClick={() => {
                  setOpen(false);
                  if (aisle !== current) onMove(aisle);
                }}
                className={`pressable rounded-full border px-3 py-1.5 text-sm ${
                  aisle === current
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {say(SHOP_AISLE_LABELS[aisle])}
              </button>
            ))}
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}
