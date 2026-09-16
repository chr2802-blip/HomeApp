"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { switchHome } from "@/app/actions/admin";
import { PhotoAvatar } from "./photo";

export type HomeOption = { id: string; name: string; photoId: string | null };

/**
 * The household you are reading, and everything that is about you rather than about
 * the lists: its settings, your profile, and the way into the other homes you belong to.
 *
 * It is the home's picture and name in the header, because that is already the thing a
 * person points at when they mean "this home, and me in it". Administering a household
 * is not a fifth tab beside Lists and Tasks — it is something you do once a month, and
 * a tab spends a place in the bar every day for it. The tabs are what the household
 * does; this is who is doing it and where.
 *
 * Unlike the three-dot menu this panel is not drawn through a portal. That one hangs
 * off cards, which clip their own contents; the header does not, so the panel can sit
 * inside it and move with it when the page scrolls.
 */
export function HomeMenu({
  homes,
  currentId,
  label,
  photoId,
  canAdminister,
}: {
  homes: HomeOption[];
  /** Null while a super admin is looking at a home they are not a member of. */
  currentId: string | null;
  label: string;
  /** The home's own picture, which is half of what is pressed to open this. */
  photoId: string | null;
  /** Whether the home on screen is theirs to run — Settings appears only then. */
  canAdminister: boolean;
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

  const entry =
    "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition hover:bg-slate-100 hover:text-slate-900";

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} — home menu`}
        data-ready={ready ? "true" : undefined}
        onClick={() => setOpen((was) => !was)}
        className="pressable flex min-w-0 items-center gap-1.5 rounded-lg text-lg font-semibold tracking-tight transition active:scale-95"
      >
        {/* The household's own picture. A home without one simply has no avatar rather
            than a placeholder standing in for it. */}
        <PhotoAvatar photoId={photoId} alt="" className="h-7 w-7" />
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
          aria-label="This home and you"
          className="animate-row-in absolute top-full left-0 z-50 mt-2 min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {canAdminister && (
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`${entry} text-slate-700`}
            >
              Settings
            </Link>
          )}
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${entry} text-slate-700`}
          >
            Profile
          </Link>

          {/* Switching homes is below the two above rather than beside them: this is a
              different question — not "what about this home" but "which home". Somebody
              with one home is never asked it; a chooser with a single choice is
              furniture. */}
          {homes.length > 1 && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              {homes.map((home) => (
                <form key={home.id} action={switchHome}>
                  <input type="hidden" name="homeId" value={home.id} />
                  <button
                    type="submit"
                    role="menuitem"
                    aria-current={home.id === currentId ? "true" : undefined}
                    className={`${entry} text-slate-700`}
                  >
                    <PhotoAvatar photoId={home.photoId} alt="" className="h-6 w-6" />
                    <span className="truncate">{home.name}</span>
                    {home.id === currentId && (
                      <span className="ml-auto shrink-0 text-xs font-normal text-slate-400">
                        Current
                      </span>
                    )}
                  </button>
                </form>
              ))}
            </div>
          )}

          <Link
            href="/homes"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${entry} mt-1 border-t border-slate-100 text-slate-500`}
          >
            All your homes
          </Link>
        </div>
      )}
    </div>
  );
}
