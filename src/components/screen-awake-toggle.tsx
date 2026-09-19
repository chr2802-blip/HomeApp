"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps the phone's screen on while a recipe is open — the one page in the app read
 * with flour on your hands rather than a finger free to tap it awake again.
 *
 * The lock is not app state and is never stored: `navigator.wakeLock` is asked for fresh
 * on this page, for this visit, and forgotten the moment the toggle goes off, the tab is
 * left, or the page is closed. Nothing here belongs to the home or the recipe.
 *
 * A browser without the API is treated the same as one that has it and refuses — the
 * button simply is not offered, since there is nothing it could promise.
 */
export function ScreenAwakeToggle({ className = "" }: { className?: string }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
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
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      // The system can take the lock back on its own (another app, low battery) without
      // the toggle being pressed again — this just forgets the stale sentinel so the
      // next visibility change is free to ask for a fresh one.
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
      });
    } catch {
      // A denial (no user gesture, battery saver) leaves the toggle off rather than
      // stuck claiming a lock that was never granted.
      setOn(false);
    }
  }, []);

  // A wake lock is released the instant the tab is hidden — switching apps, locking the
  // phone to read the next step off a different device — and never comes back on its
  // own. This puts it back the moment the recipe is on screen again, for as long as the
  // toggle is still on; toggling off, leaving the page, or closing the tab all run the
  // same cleanup through this effect's teardown.
  useEffect(() => {
    if (!on) return;
    acquire();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      release();
    };
  }, [on, acquire, release]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => setOn((value) => !value)}
      aria-pressed={on}
      aria-label="Keep screen on"
      title={on ? "Screen will stay on — tap to allow it to sleep" : "Keep screen on while cooking"}
      className={`pressable shrink-0 rounded-lg p-2 active:scale-90 ${
        on ? "text-[var(--accent)]" : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
