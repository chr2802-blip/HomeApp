"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/modal";

/**
 * A small round control that opens a sheet — the recipe page's portions, rating and
 * "Add to list", which used to take a card and a row of their own each above and inside
 * the ingredients. Each is something done now and then rather than read every visit, so
 * the page shows only an icon, and what it currently says where there is something worth
 * seeing at a glance (the portions being cooked for, the average) beside it.
 *
 * `children` is handed the way to close the sheet, for a sheet whose one press is also
 * its last one — choosing a list closes it; a heart does not.
 *
 * `data-ready` is for the browser suite, like a `ContextMenu`'s: hydration leaves no
 * mark of its own, and a press before React has attached opens nothing.
 */
export function SheetButton({
  label,
  icon,
  value,
  title = label,
  disabled = false,
  busy = false,
  children,
}: {
  /** The button's accessible name — what it opens. */
  label: string;
  icon: ReactNode;
  /** Shown beside the icon: what the control currently stands at, if anything. */
  value?: ReactNode;
  title?: string;
  disabled?: boolean;
  busy?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-busy={busy || undefined}
        data-ready={ready ? "true" : undefined}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="pressable inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-full border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700 tabular-nums hover:bg-slate-100 active:scale-[0.92] disabled:opacity-50 disabled:active:scale-100"
      >
        {icon}
        {value !== undefined && value !== null && (
          <span aria-hidden="true">{value}</span>
        )}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {children(() => setOpen(false))}
      </Modal>
    </>
  );
}
