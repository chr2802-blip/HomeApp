"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * What an AI wait tells the person waiting: the headline, one sentence of why, the
 * stages the reader is working through, and roughly how long it usually takes.
 * `recipeSaveOverlay` and `recipeImportOverlay` in `recipe-fields.tsx` are the two.
 */
export type AiWait = {
  title: string;
  detail: string;
  stages: string[];
  expectedSeconds: number;
};

/** How long each stage line stays up before the next one takes over. */
const STAGE_MS = 2800;

/**
 * The whole screen, for as long as an action that spends a model call is pending — the
 * link import and every recipe save wear the same one, so the two waits read as the same
 * machine at work rather than two features with two spinners.
 *
 * Portalled to `document.body` and `fixed`, above the sheet (`Modal` is `z-50`): a
 * `fixed` child of the sheet would be contained by `PageTransition`'s `transform`, and
 * covering only the sheet's middle left its header and footer looking pressable.
 *
 * The stage lines walk forward and stop on the last one rather than looping — a loop is
 * how a person notices the list is decoration. The bar eases towards, and never reaches,
 * the end: it is paced by `expectedSeconds` and is a promise that something is moving,
 * not a measurement, so it must never sit at 100% while the request is still out.
 */
export function AiOverlay({ active, ...wait }: { active: boolean } & AiWait) {
  if (!active) return null;
  return createPortal(<AiWaitScreen {...wait} />, document.body);
}

function AiWaitScreen({ title, detail, stages, expectedSeconds }: AiWait) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, []);

  const stage = Math.min(Math.floor(elapsed / STAGE_MS), stages.length - 1);
  // 1 - e^(-t/τ): about 85% at the expected time, then crawling, capped short of full.
  const progress = Math.min(0.95, 1 - Math.exp(-elapsed / ((expectedSeconds * 1000) / 1.9)));

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ai-overlay"
      className="animate-backdrop-in fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-white/95 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center backdrop-blur-md"
    >
      <div aria-hidden="true" className="ai-aurora pointer-events-none absolute -inset-1/3" />

      <div aria-hidden="true" className="relative h-36 w-36">
        <div className="ai-halo absolute inset-0 rounded-full" />
        <div className="ai-ring absolute inset-3 rounded-full" />
        <div className="absolute inset-[18px] rounded-full bg-white shadow-inner" />
        <div className="ai-orbit absolute inset-0">
          <span className="ai-orbit-dot left-1/2 top-0" />
        </div>
        <div className="ai-orbit ai-orbit-slow absolute inset-2">
          <span className="ai-orbit-dot ai-orbit-dot-small left-0 top-1/2" />
        </div>
        <svg
          viewBox="0 0 24 24"
          className="ai-sparkle absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2"
        >
          <path
            fill="var(--accent)"
            d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5Z"
          />
          <path
            fill="#8b5cf6"
            d="M18.5 14.5c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3Z"
          />
          <path
            fill="#06b6d4"
            d="M5.5 15.5c.15 1.3.9 2 2.2 2.2-1.3.15-2.05.9-2.2 2.2-.15-1.3-.9-2.05-2.2-2.2 1.3-.2 2.05-.9 2.2-2.2Z"
          />
        </svg>
      </div>

      <div className="relative mt-8 max-w-sm">
        <p className="ai-title text-lg font-semibold">{title}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </div>

      <div className="relative mt-8 w-full max-w-xs">
        <p key={stage} className="ai-stage h-5 text-sm font-medium text-slate-700" data-stage={stage}>
          {stages[stage]}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="ai-bar h-full rounded-full"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <ol className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {stages.map((_, index) => (
            <li
              key={index}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index < stage
                  ? "w-1.5 bg-[var(--accent)]"
                  : index === stage
                    ? "ai-step-now w-5"
                    : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
