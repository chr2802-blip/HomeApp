"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { needsReading, type SavedReading } from "@/lib/cook";

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
  /**
   * For a recipe save, the reading already stored (or carried by an import) — so the
   * wait is drawn only for a submission that will actually be read (`needsReading`),
   * never for one the server answers without the model. Absent for a wait that always
   * spends a call, like an import.
   */
  reads?: { saved: SavedReading | null };
};

/**
 * Whether this submission is one the AI is working on: pending, and — for a save — one
 * `needsReading` says the server will actually send to the reader.
 */
export function aiWaitActive(wait: AiWait | undefined, pending: boolean, submitted: FormData | null) {
  if (!wait || !pending) return false;
  if (!wait.reads || !submitted) return true;
  const field = (name: string) => String(submitted.get(name) ?? "");
  return needsReading({ ingredients: field("ingredients"), instructions: field("instructions") }, wait.reads.saved);
}

/**
 * How long the finished screen stays up once the answer is back: long enough to see the
 * bar reach the end, short enough not to be a wait of its own.
 */
export const FINISH_MS = 300;

/**
 * The whole screen, for as long as an action that spends a model call is pending — the
 * link import and every recipe save wear the same one, so the two waits read as the same
 * machine at work rather than two features with two spinners.
 *
 * Portalled to `document.body` and `fixed`, above the sheet (`Modal` is `z-50`): a
 * `fixed` child of the sheet would be contained by `PageTransition`'s `transform`, and
 * covering only the sheet's middle left its header and footer looking pressable.
 *
 * **Paced by `expectedSeconds`, which is the typical wait and not a ceiling.** The stage
 * lines divide that time between them, so the last one arrives shortly before a typical
 * answer does, and they stop on the last one rather than looping — a loop is how a person
 * notices the list is decoration. The bar eases towards, and never reaches, the end while
 * the request is out: it is a promise that something is moving, not a measurement.
 *
 * **When the answer arrives the bar finishes rather than vanishing.** It fills to the end
 * and every stage is marked done for `FINISH_MS` before the screen goes. Unmounting on the
 * spot, a wait that came back faster than its pacing disappeared at half a bar and the
 * middle stage, which read as the loader being cut off rather than the work being done.
 */
export function AiOverlay({ active, wait }: { active: boolean; wait: AiWait }) {
  const [finishing, setFinishing] = useState(false);
  // A new wait starts its clock from nothing, even one submitted while the last was
  // still finishing — keyed, so the screen is a fresh one rather than a resumed one.
  const [run, setRun] = useState(0);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      setFinishing(false);
      setRun((count) => count + 1);
      return;
    }
    if (!wasActive.current) return;
    wasActive.current = false;
    setFinishing(true);
    const timer = window.setTimeout(() => setFinishing(false), FINISH_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!active && !finishing) return null;
  return createPortal(<AiWaitScreen key={run} {...wait} done={!active} />, document.body);
}

function AiWaitScreen({ title, detail, stages, expectedSeconds, done }: AiWait & { done: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (done) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, [done]);

  const expectedMs = expectedSeconds * 1000;
  // Each stage gets an equal share of the typical wait, the last one included.
  const stageMs = expectedMs / stages.length;
  const stage = done ? stages.length - 1 : Math.min(Math.floor(elapsed / stageMs), stages.length - 1);
  // 1 - e^(-t/τ): about 85% at the expected time, then crawling, capped short of full.
  const progress = done ? 1 : Math.min(0.95, 1 - Math.exp(-elapsed / (expectedMs / 1.9)));

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="ai-overlay"
      className="ai-overlay animate-backdrop-in fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-white/95 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center backdrop-blur-md"
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
            style={{ fill: "var(--accent)" }}
            d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5Z"
          />
          <path
            style={{ fill: "var(--ai-light)" }}
            d="M18.5 14.5c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3Z"
          />
          <path
            style={{ fill: "var(--ai-deep)" }}
            d="M5.5 15.5c.15 1.3.9 2 2.2 2.2-1.3.15-2.05.9-2.2 2.2-.15-1.3-.9-2.05-2.2-2.2 1.3-.2 2.05-.9 2.2-2.2Z"
          />
        </svg>
      </div>

      <div className="relative mt-8 max-w-sm">
        <p className="ai-title text-lg font-semibold">{title}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </div>

      <div className="relative mt-8 w-full max-w-xs">
        <p
          key={stage}
          className="ai-stage h-5 text-sm font-medium text-slate-700"
          data-stage={stage}
          data-done={done || undefined}
        >
          {stages[stage]}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="ai-bar h-full rounded-full"
            data-done={done || undefined}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <ol className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {stages.map((_, index) => (
            <li
              key={index}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index < stage || done
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
