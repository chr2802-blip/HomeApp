"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeping the phone's screen on, for as long as something on the page wants it.
 *
 * Action mode holds it for as long as it is open. The recipe page used to offer it as a
 * toggle too; that went once action mode was where cooking happens. What is kept here is
 * every awkward part — asking, being refused, and getting it back.
 *
 * The lock is never stored and never belongs to the home or the recipe: it is asked for
 * fresh, for this visit, and forgotten the moment `wanted` goes false, the tab is left,
 * or the page is closed.
 *
 * `supported` is resolved in an effect rather than during render, so the server's markup
 * and the browser's first pass agree — a caller that hides itself on `false` would
 * otherwise hydrate into a mismatch.
 */
export function useWakeLock(wanted: boolean) {
  const [supported, setSupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "wakeLock" in navigator);
  }, []);

  const release = useCallback(() => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    sentinel?.release().catch(() => {});
  }, []);

  const acquire = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      // The system can take the lock back on its own — another app, a low battery —
      // without anything here being pressed. This just forgets the stale sentinel, so
      // the next visibility change is free to ask for a fresh one.
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
      });
    } catch {
      // A denial (no user gesture, battery saver) is not worth reporting: nothing was
      // promised, and the caller's own state already says what it wanted.
    }
  }, []);

  // A wake lock is released the instant the tab is hidden — switching apps, locking the
  // phone — and never comes back on its own. This puts it back the moment the page is on
  // screen again, for as long as it is still wanted; no longer wanting it, leaving the
  // page and closing the tab all run the same cleanup through this teardown.
  useEffect(() => {
    if (!wanted) return;
    acquire();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [wanted, acquire, release]);

  return { supported };
}
