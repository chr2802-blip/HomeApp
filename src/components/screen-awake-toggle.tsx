"use client";

import { useState } from "react";

import { useWakeLock } from "./use-wake-lock";

/**
 * Keeps the phone's screen on while a recipe is open — the one page in the app read
 * with flour on your hands rather than a finger free to tap it awake again.
 *
 * The lock itself is `useWakeLock`'s, shared with action mode, which holds one for as
 * long as it is open rather than offering a button for it. All that is here is the
 * button: what it looks like, and whether this browser can be offered it at all.
 *
 * A browser without the API is treated the same as one that has it and refuses — the
 * button simply is not offered, since there is nothing it could promise.
 */
export function ScreenAwakeToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(false);
  const { supported } = useWakeLock(on);

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
