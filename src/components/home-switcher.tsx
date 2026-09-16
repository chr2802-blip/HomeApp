"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { switchHome } from "@/app/actions/admin";
import { PhotoAvatar } from "./photo";

export type HomeOption = { id: string; name: string; photoId: string | null };

/**
 * Which household you are reading, and the way into the others you belong to.
 *
 * It replaces the home's name in the header rather than sitting beside it, because the
 * name is already the answer to "which home is this" — pressing it to ask "which else"
 * is the same question continued. Somebody in one home never sees it: a chooser with a
 * single choice is furniture.
 *
 * Unlike the three-dot menu this panel is not drawn through a portal. That one hangs
 * off cards, which clip their own contents; the header does not, so the panel can sit
 * inside it and move with it when the page scrolls.
 */
export function HomeSwitcher({
  homes,
  currentId,
  label,
}: {
  homes: HomeOption[];
  /** Null while a super admin is looking at a home they are not a member of. */
  currentId: string | null;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Hydration leaves no mark of its own, so this is the mark: the trigger says when it
  // can really open, and the browser tests wait on it instead of guessing.
  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} — switch home`}
        data-ready={ready ? "true" : undefined}
        onClick={() => setOpen((was) => !was)}
        className="pressable flex min-w-0 items-center gap-1 rounded-lg text-lg font-semibold tracking-tight transition active:scale-95"
      >
        <span className="truncate">{label}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-[rotate] duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Your homes"
          className="animate-row-in absolute top-full left-0 z-50 mt-2 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {homes.map((home) => (
            <form key={home.id} action={switchHome}>
              <input type="hidden" name="homeId" value={home.id} />
              <button
                type="submit"
                role="menuitem"
                aria-current={home.id === currentId ? "true" : undefined}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <PhotoAvatar photoId={home.photoId} alt="" className="h-6 w-6" />
                <span className="truncate">{home.name}</span>
                {home.id === currentId && (
                  <span className="ml-auto shrink-0 text-xs font-normal text-slate-400">Current</span>
                )}
              </button>
            </form>
          ))}
          <Link
            href="/homes"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full items-center border-t border-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            All your homes
          </Link>
        </div>
      )}
    </div>
  );
}
