"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * How long the closing animation runs. The sheet stays mounted for exactly this long
 * after `open` goes false, so it is seen leaving rather than vanishing — and a shorter
 * exit than entrance is what a dismissal feels like on a phone.
 *
 * Must match the duration of `animate-sheet-out` and `animate-backdrop-out` in
 * globals.css: unmounting early cuts the exit short, unmounting late leaves the sheet
 * sitting off screen with the page behind it unusable.
 */
const EXIT_MS = 200;

/**
 * Full-screen sheet on mobile, centred dialog from `sm` up.
 * Mounts through a portal so it always sits above the bottom tab bar.
 *
 * The sheet arrives the way the platform it is on does: up from the bottom edge on a
 * phone, where it fills the screen, and a scale-and-fade on a desktop, where it is a
 * panel over the page. Both curves are weighted towards the end of the movement, which
 * is what makes a sheet read as thrown rather than dragged. The movement itself is a
 * keyframe animation in globals.css rather than a transition between two class names —
 * a transition needs the state it starts from to have been painted, and nothing is
 * painted between a sheet being mounted and being opened.
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
  const [closing, setClosing] = useState(false);

  // Opening needs no second step: the entrance is an animation, which runs from the
  // moment the sheet is in the document. Closing does, because the sheet has to outlive
  // the `open` that dismissed it for as long as its exit takes.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    setClosing(true);
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

  // A phone's back gesture and a browser's back button are both "go back", and a sheet
  // open over a page is a place people expect that to close the sheet rather than leave
  // the page behind it. So opening pushes one history entry that stands for the sheet,
  // and back — a `popstate` — closes it instead of being left to the router. `onClose`
  // is read from a ref rather than a dependency: it is a fresh `() => setOpen(false)` on
  // every render of whatever opened this, and depending on it directly would tear the
  // listener down and re-push a history entry on every one of those renders.
  //
  // It never pops that entry itself on a non-back close (Cancel, the × button, Escape, a
  // successful save) — see `docs/design/ui-patterns.md` for the two things this was
  // tried as first and what each one broke. What it does instead is not push a *second*
  // entry when one sheet closes and another opens right after on the same page: the
  // marker only stands for "back should close whatever sheet is open here", and one
  // already on top of the stack answers that exactly as well as a fresh one would.
  // Checked through `window.history.state` rather than a variable this component keeps
  // itself, because the App Router rewrites that state object on every save made inside
  // a sheet — the mark does not reliably survive a mutation, so a sheet opened right
  // after one pushes a new entry after all. Reusing is a saving where it costs nothing;
  // it is never the thing standing between a save and being lost.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const state = window.history.state as { homehubModal?: boolean } | null;
    if (!state?.homehubModal) window.history.pushState({ homehubModal: true }, "");
    const onPopState = () => onCloseRef.current();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4">
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-[3px] ${
          closing ? "animate-backdrop-out" : "animate-backdrop-in"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Which way it moves, and how far, is the animation's business: up from the
        // bottom edge on a phone and a scale-and-fade from `sm` up, chosen by the one
        // media query in globals.css rather than by `sm:` classes here.
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl ${
          closing ? "animate-sheet-out" : "animate-sheet-in"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight break-words">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90"
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
  ...rest
}: { className?: string; children: React.ReactNode } & Omit<
  React.ComponentProps<"div">,
  "className" | "children"
>) {
  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 ${className}`}
      {...rest}
    >
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
