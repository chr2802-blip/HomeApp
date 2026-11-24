"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Modal, ModalBody } from "@/components/modal";
import { useLanguage } from "@/components/language-provider";
import { SHEET_EXIT_MS } from "@/lib/motion";
import { sayIn } from "@/lib/copy/say";
import { CREATE_CHOICES, type CreateChoice } from "@/lib/create-choices";
import { APP } from "@/lib/copy/app";

const noChange = () => () => {};

/**
 * The address a `CreateMenu` row sends somebody to: the page whose "+" makes that thing,
 * told to open it on arrival.
 */
export const CREATE_PARAM = "new";

/**
 * The page's "+". On a phone it sits in the gap in the middle of the tab bar and, when the
 * bar slides away on the way down a page, travels to the bottom right corner instead and
 * stays (the CSS is `.app-create` in globals.css); from `md` up it is in that corner all
 * along. Where a page has nothing to make, the tab bar shows a greyed-out "+" in its place.
 *
 * Drawn into <body>: the page sits in an element that animates in, and a transformed
 * ancestor would make `fixed` mean "fixed to the page" instead of to the screen.
 *
 * One per page. Its name is what it makes ("New list"), because that is the only thing
 * that says so — the button itself is a bare "+". A page arrived at with `?new` presses
 * it once by itself, which is how the dashboard's `CreateMenu` opens another page's sheet.
 */
export function CreateFab({
  label,
  onClick,
  expanded,
  above = false,
}: {
  label: string;
  onClick: () => void;
  expanded?: boolean;
  /** Drawn over the sheets rather than under them: while its own drawer is open or leaving. */
  above?: boolean;
}) {
  const browser = useSyncExternalStore(
    noChange,
    () => true,
    () => false,
  );
  const press = useRef(onClick);
  useEffect(() => {
    press.current = onClick;
  }, [onClick]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CREATE_PARAM)) return;
    // Taken off the address first: the sheet pushes an entry of its own, and the one under
    // it must not open the sheet again when somebody comes back to it.
    url.searchParams.delete(CREATE_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    press.current();
  }, []);

  if (!browser) return null;
  return createPortal(
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
      className={`app-create press-icon fixed ${above ? "z-[60]" : "z-[45]"} flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_10px_24px_-6px_rgb(60_40_20/0.55)] ring-4 ring-[#ffffff] hover:bg-[var(--accent-hover)] md:ring-0`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>,
    document.body,
  );
}

export type { CreateChoice };

/**
 * Several things to make, from a page that makes none of them itself (the dashboard): the
 * "+" opens a drawer with a row for each, and stays above it as its ×. A row goes to the
 * page that makes that thing and opens its sheet there (`CREATE_PARAM`), so there is one
 * sheet per kind of thing and not a copy of it here.
 */
export function CreateMenu({
  choices = CREATE_CHOICES,
  inBar = false,
}: {
  choices?: CreateChoice[];
  /**
   * Drawn in the tab bar's own gap rather than as the page's floating "+": the one a page
   * that makes nothing shows (`.app-create-idle`, hidden by CSS wherever a page has a "+"
   * of its own), so the "+" is somewhere to start from on every page.
   */
  inBar?: boolean;
}) {
  const say = sayIn(useLanguage());
  const [open, setOpen] = useState(false);
  // Dismissed, the drawer slides away on its own, and the "+" stays above it until it has
  // gone — dropping behind it halfway makes the button flicker.
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(false), SHEET_EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  const dismiss = () => {
    setOpen(false);
    setLeaving(true);
  };

  return (
    <>
      {inBar ? (
        <button
          type="button"
          aria-label={say(APP.create)}
          title={say(APP.create)}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? dismiss() : setOpen(true))}
          className="app-create-idle press-icon absolute bottom-2.5 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_10px_24px_-6px_rgb(60_40_20/0.55)] ring-4 ring-[#ffffff] hover:bg-[var(--accent-hover)]"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      ) : (
        <CreateFab
          label={say(APP.create)}
          onClick={() => (open ? dismiss() : setOpen(true))}
          expanded={open}
          above={open || leaving}
        />
      )}
      <Modal open={open} onClose={dismiss} title={say(APP.create)} size="drawer">
        <ModalBody className="pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-5">
          <ul className="menu-rows -mx-2 flex flex-col">
            {choices.map((choice) => (
              <li key={choice.href}>
                <Link
                  href={`${choice.href}?${CREATE_PARAM}`}
                  onClick={() => setOpen(false)}
                  className="press-button flex w-full items-center rounded-xl px-3 py-3 text-left text-base font-medium text-slate-800 hover:bg-slate-100"
                >
                  <span
                    aria-hidden="true"
                    className="accent-tint-bg mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                  >
                    {choice.emoji}
                  </span>
                  {say(choice.label)}
                </Link>
              </li>
            ))}
          </ul>
        </ModalBody>
      </Modal>
    </>
  );
}
