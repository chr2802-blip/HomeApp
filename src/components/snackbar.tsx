"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A word about a press that already landed — "Added to Shopping. Salt, Pepper and 5
 * more are already in the pantry" — rather than a question or a thing to read closely.
 * It used to be a line of text pushed into whatever card held the button that caused
 * it, which on a recipe's ingredients meant a sentence about the shopping list wrapping
 * in among the very lines it was reporting on. Said here instead: one at a time, fixed
 * above the tab bar, gone on its own after `DURATION_MS`.
 *
 * Portalled to `document.body` for the same reason `ContextMenu`'s panel is: the cards
 * this fires from clip their own contents.
 */

const DURATION_MS = 4000;

type Tone = "default" | "error";
type Snack = { id: number; message: string; tone: Tone };

const Notify = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snack, setSnack] = useState<Snack | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const notify = useCallback((message: string, tone: Tone = "default") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const id = ++nextId.current;
    setSnack({ id, message, tone });
    timeoutRef.current = setTimeout(() => {
      setSnack((current) => (current?.id === id ? null : current));
    }, DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <Notify.Provider value={notify}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(
            // A live region that is always there, so an update inside it is announced —
            // an element that only mounts once there is something to say is one screen
            // readers have nothing to have already found.
            <div
              aria-live="polite"
              role="status"
              className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
            >
              {snack && (
                <div
                  key={snack.id}
                  className={`animate-row-in pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-center text-sm font-medium shadow-lg ${
                    snack.tone === "error" ? "bg-red-600 text-white" : "bg-slate-900 text-white"
                  }`}
                >
                  {snack.message}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </Notify.Provider>
  );
}

export function useSnackbar(): (message: string, tone?: Tone) => void {
  const notify = useContext(Notify);
  if (!notify) throw new Error("useSnackbar must be used within a SnackbarProvider");
  return notify;
}
