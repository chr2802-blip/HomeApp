"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * How long the closing animation runs. The sheet stays mounted for exactly this long
 * after `open` goes false, so it is seen leaving rather than vanishing — and a shorter
 * exit than entrance is what a dismissal feels like on a phone.
 */
const EXIT_MS = 200;

/**
 * Full-screen sheet on mobile, centred dialog from `sm` up.
 * Mounts through a portal so it always sits above the bottom tab bar.
 *
 * The sheet arrives the way the platform it is on does: up from the bottom edge on a
 * phone, where it fills the screen, and a scale-and-fade on a desktop, where it is a
 * panel over the page. Both curves are weighted towards the end of the movement, which
 * is what makes a sheet read as thrown rather than dragged.
 *
 * Its contents are laid out top to bottom: `ModalBody` scrolls, `ModalFooter` does not,
 * so a form's buttons stay on screen however long the form is. A dialog whose Save
 * button is below the fold is a dialog people close without saving.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4">
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[3px] transition-opacity ease-out ${
          shown ? "opacity-100 duration-300" : "opacity-0 duration-200"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-[transform,opacity] ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl ${
          shown
            ? "translate-y-0 duration-300 sm:scale-100 sm:opacity-100"
            : // Off the bottom edge on a phone, where the sheet is the whole screen and
              // fading it would only make the slide harder to see; in place but small
              // and faint on a desktop, where it is a panel over a page that stays put.
              "translate-y-full duration-200 sm:translate-y-0 sm:scale-95 sm:opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* A column rather than the scrolling box it used to be: what scrolls and what
            stays is now the content's own decision, which is how the footer stays put. */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** The part of a sheet that scrolls: everything except its actions. */
export function ModalBody({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 ${className}`}>
      {children}
    </div>
  );
}

/**
 * The bar along the bottom of a sheet, holding what it is for: Save, Delete, Cancel.
 *
 * It sits outside the scrolling body, so the buttons are on screen from the moment the
 * sheet opens however long the form inside it is. The extra padding underneath keeps
 * them clear of a phone's home indicator, which on a full-screen sheet sits right on
 * top of them.
 */
export function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
      {children}
    </div>
  );
}
