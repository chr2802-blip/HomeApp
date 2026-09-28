"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

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
 * Takes a closed sheet's history entry back off without the App Router noticing.
 *
 * The router answers every `popstate` by restoring the tree it filed under the entry
 * landed on — for the entry below a sheet, the page as it was when the sheet opened. A
 * save made in the sheet happened after that, so restoring it would put back what the
 * save removed. So the one traverse this starts is swallowed before the router's own
 * listener hears it, and the entry landed on is handed the tree the router has now,
 * which is what a later back or forward onto it should restore.
 */
let ownPop: { tree: unknown } | null = null;

function popOwnEntry() {
  ownPop = { tree: window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE };
  window.history.back();
}

if (typeof window !== "undefined") {
  // Capturing, and registered when this module loads — before the router mounts and adds
  // its own — so it runs first and can stop the router's.
  window.addEventListener(
    "popstate",
    (event) => {
      if (!ownPop) return;
      const { tree } = ownPop;
      ownPop = null;
      event.stopImmediatePropagation();
      if (tree && event.state?.__NA) {
        window.history.replaceState(
          { ...event.state, __PRIVATE_NEXTJS_INTERNALS_TREE: tree },
          "",
        );
      }
    },
    { capture: true },
  );
}

/**
 * Full-screen sheet on mobile, centred dialog from `sm` up.
 * Mounts through a portal so it always sits above the bottom tab bar.
 *
 * `size="drawer"` is the same sheet for something small — a stepper, the hearts, a
 * choice of list, an "are you sure": on a phone it rises from the bottom edge only as
 * far as its contents need, with the page still showing above it, rather than taking
 * the whole screen for one row of controls. Anything with fields to fill in stays the
 * whole screen: a form runs past the fold, and a drawer grown to the full height is a
 * full-screen sheet with a gap at the top. From `sm` up the two are the same panel.
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
  size = "screen",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The whole screen on a phone, or only as tall as the contents. */
  size?: "screen" | "drawer";
  children: React.ReactNode;
}) {
  const drawer = size === "drawer";
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const say = sayIn(useLanguage());

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
  // Closing any other way — Cancel, the ×, Escape, a successful save — takes that entry
  // back off, or the next back press lands on the same page and looks like it did
  // nothing. It is taken off with `popOwnEntry` (above), which hides the traverse from the
  // App Router: letting the router see it restores a snapshot frozen when the sheet
  // opened, and undoes the save that closed it. `docs/design/ui-patterns.md` has both.
  //
  // The pop is deferred a tick, and a re-run of this effect cancels it, because React's
  // development double-run closes and reopens every sheet in the same breath.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const pendingPop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    if (pendingPop.current !== undefined) {
      clearTimeout(pendingPop.current);
      pendingPop.current = undefined;
    } else {
      window.history.pushState({ homehubModal: true }, "");
    }
    const href = window.location.href;
    let poppedByBack = false;
    const onPopState = () => {
      poppedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (poppedByBack) return;
      pendingPop.current = setTimeout(() => {
        pendingPop.current = undefined;
        // A save that navigated has already left the entry behind, on a new page.
        if (window.location.href === href) popOwnEntry();
      }, 0);
    };
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4 ${
        drawer ? "items-end" : ""
      }`}
    >
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
        //
        // A drawer ends on the phone's home indicator, so it pads past the bottom inset
        // itself — unless it has a footer, which already does.
        data-size={size}
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl ${
          drawer
            ? "max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)] has-[[data-modal-footer]]:pb-0 sm:pb-0"
            : ""
        } ${closing ? "animate-sheet-out" : "animate-sheet-in"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight break-words">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={say(APP.close)}
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
    <div
      data-modal-footer
      className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4"
    >
      {children}
    </div>
  );
}
