"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * The three dots that hold what is done *to* a thing rather than *with* it — editing
 * it, deleting it.
 *
 * Those two belong together and neither is wanted often, so they sit behind one button
 * instead of spending a row of every card on them. Keeping them off the face of a card
 * also means the card itself can stay a single target: on a phone a row carrying a
 * Delete button beside a link is a row where Delete gets hit.
 *
 * The panel is drawn through a portal rather than beside its trigger, because the
 * things it belongs to are cards that clip their own contents — a menu rendered inside
 * one would be cut off at the card's edge. Being outside the card, it is positioned
 * from the trigger's box on the screen, and closes rather than chases when the page
 * scrolls underneath it.
 */

const CloseMenu = createContext<() => void>(() => {});

type Position = { top: number; right: number };

const GAP = 6;
const EDGE = 8;

export function ContextMenu({
  label,
  className = "",
  children,
}: {
  /** What this menu acts on, e.g. the list's title — it names the button. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [ready, setReady] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hydration leaves no mark of its own: the trigger's markup is identical before and
  // after React attaches its listeners, so a press in between does nothing and looks
  // like nothing. This says when the button is really a menu button — the browser tests
  // wait on it rather than guessing.
  useEffect(() => setReady(true), []);

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    setPosition({ top: box.bottom + GAP, right: Math.max(EDGE, window.innerWidth - box.right) });
  }, []);

  // Once the panel has a height, flip it above the trigger if it would otherwise run
  // off the bottom of the screen — which is where a menu on the last card of a page
  // always opens.
  useLayoutEffect(() => {
    if (!open || !position || !panelRef.current || !triggerRef.current) return;
    const height = panelRef.current.offsetHeight;
    if (position.top + height <= window.innerHeight - EDGE) return;

    const box = triggerRef.current.getBoundingClientRect();
    const top = Math.max(EDGE, box.top - GAP - height);
    if (top !== position.top) setPosition({ ...position, top });
  }, [open, position]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    // The panel is pinned to a point on the screen, so it has to be re-pinned when the
    // page moves under it. Dismissing instead would be simpler and wrong: a scroll
    // started before the press is delivered after it, and would shut the menu the press
    // had just opened.
    const onMove = () => place();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  // The first entry takes focus, so the menu can be worked from the keyboard the way it
  // was opened. Without preventScroll the browser scrolls the page to the panel — which
  // sits at the end of the document, far from the card it belongs to — and the scroll
  // handler above then closes the menu that had only just opened.
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector<HTMLElement>("[role='menuitem']")
      ?.focus({ preventScroll: true });
  }, [open, position]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-ready={ready ? "true" : undefined}
        aria-label={`Actions for ${label}`}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          place();
          setOpen(true);
        }}
        className={`pressable shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90 ${className}`}
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="10" cy="16" r="1.6" />
        </svg>
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={`Actions for ${label}`}
              style={{ top: position.top, right: position.right }}
              className="animate-row-in fixed z-50 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              <CloseMenu.Provider value={close}>{children}</CloseMenu.Provider>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const ICONS = {
  pencil: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z",
  bin: "M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12",
} as const;

/**
 * One entry. It closes the menu before doing its work, so whatever it opens — a sheet,
 * a confirmation — is the only thing on screen once it arrives.
 */
export function MenuItem({
  onSelect,
  icon,
  tone = "default",
  children,
}: {
  onSelect: () => void;
  icon?: keyof typeof ICONS;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  const close = useContext(CloseMenu);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        close();
        onSelect();
      }}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition ${
        tone === "danger"
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {icon && (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d={ICONS[icon]} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
