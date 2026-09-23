"use client";

import type { HomeLanguage } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { clockLabel, type CookStep } from "@/lib/cook";
import { cheer, tick } from "@/lib/haptics";
import { timeLabel } from "@/lib/recipes";
import type { FormAction } from "@/lib/action-result";
import { Button } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { useWakeLock } from "@/components/use-wake-lock";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { APP } from "@/lib/copy/app";

/**
 * Action mode: a recipe read at the hob rather than at the table.
 *
 * One step fills the screen, with the ingredients that step uses beside it and nothing
 * else — the recipe is unchanged, this is a second way of reading the same one. The
 * pages turn like a cookbook's, leftwards to go on, because that is what lifting a
 * right-hand page over does and what every gallery on the phone already means by it.
 *
 * **It is portalled to `document.body`, and that is not a preference.** The app's layout
 * animates the page it renders with a keyframe that puts a `transform` on an ancestor,
 * and a transformed ancestor contains a fixed child — rendered in place, this surface
 * would be trapped under the header and the tab bar for as long as that ran. Portalling
 * also puts it above the tab bar's own `z-40`, and `data-theme` still reaches it, since
 * that lives on `<html>`.
 *
 * The whole thing works on a recipe that was never prepared: the steps show plainly,
 * with no ingredients and no timers, and the offer to prepare it is on the first page.
 * Guessing which ingredients a step uses by matching words against it would be the one
 * thing `lib/cook.ts` exists to refuse.
 */

/** How far a thumb must travel across before it counts as turning a page rather than
 *  tapping something or scrolling a long step. The same distance the one other swipe in
 *  this app uses (`meal-week.tsx`), because two swipes that disagree about what a swipe
 *  is are worse than either. */
const SWIPE_THRESHOLD_PX = 60;

type Timer = { step: number; endsAt: number };

export function CookMode({
  recipeId,
  title,
  steps,
  ingredients,
  prepared,
  prepareAction,
}: {
  recipeId: string;
  title: string;
  steps: CookStep[];
  ingredients: string[];
  prepared: boolean;
  prepareAction: FormAction;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const language = useLanguage();
  const say = sayIn(language);

  // Page 0 is the mise en place, then one page per step. The ingredients are a page
  // rather than a panel on every step because reading them all through once is what a
  // cook does before starting and never again. There is no page after the last step:
  // completing it is a close, not a turn.
  const pageCount = steps.length + 1;
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<"next" | "back" | null>(null);

  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const rung = useRef(new Set<number>());

  // The screen stays on for as long as this is open. Nothing to press: somebody who has
  // opened the cooking view has already said what they are doing for the next half hour.
  useWakeLock(mounted);

  useEffect(() => {
    setMounted(true);
  }, []);

  // The page behind must not scroll under the surface, the same way a sheet stops it.
  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted]);

  const goTo = useCallback(
    (next: number, direction: "next" | "back") => {
      if (next < 0 || next >= pageCount) return;
      setTurn(direction);
      setPage(next);
      // Beside the change rather than after it: feedback about a press must not wait on
      // a render, which is the same reason a list's tick is handled where it is.
      tick();
    },
    [pageCount],
  );

  const leave = useCallback(() => router.push(`/recipes/${recipeId}`), [router, recipeId]);

  // The last page turns nowhere — turning past it is finishing, so it closes the mode
  // instead of moving to one more screen that only exists to say so.
  const complete = useCallback(() => {
    cheer();
    leave();
  }, [leave]);

  const forward = useCallback(
    () => (page === pageCount - 1 ? complete() : goTo(page + 1, "next")),
    [complete, goTo, page, pageCount],
  );
  const back = useCallback(() => goTo(page - 1, "back"), [goTo, page]);

  // A screen that can only be swiped is a screen a desktop and a keyboard cannot use.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") forward();
      else if (event.key === "ArrowLeft") back();
      else if (event.key === "Escape") leave();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [forward, back, leave]);

  // Only while something is counting: an interval left running behind a finished timer
  // is a phone kept awake for nothing.
  useEffect(() => {
    if (!timers.length) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timers.length]);

  // A timer reaching zero is worth feeling, once. `rung` is a ref rather than state
  // because noticing must not itself cause the render that would notice again.
  useEffect(() => {
    for (const timer of timers) {
      if (timer.endsAt <= now && !rung.current.has(timer.endsAt)) {
        rung.current.add(timer.endsAt);
        cheer();
      }
    }
  }, [timers, now]);

  const drag = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(event: React.PointerEvent) {
    drag.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: React.PointerEvent) {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Horizontal enough, and far enough — otherwise this was a tap on something on the
    // page, or scrolling a step too long to fit.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) forward();
    else back();
  }

  function startTimer(step: number, minutes: number) {
    tick();
    setTimers((running) => [
      // One timer per step: pressing the chip again restarts that step's, which is what
      // somebody who has just put the potatoes back on means by it.
      ...running.filter((timer) => timer.step !== step),
      { step, endsAt: Date.now() + minutes * 60_000 },
    ]);
    setNow(Date.now());
  }

  function stopTimer(step: number) {
    setTimers((running) => running.filter((timer) => timer.step !== step));
  }

  if (!mounted || typeof document === "undefined") return null;

  const step = page > 0 && page <= steps.length ? steps[page - 1] : null;
  const isLastStep = page === pageCount - 1;
  // A recipe with no steps at all (a reel with nothing written down) has only the mise
  // en place, so that one page is both the first and the last.
  const progress = pageCount > 1 ? page / (pageCount - 1) : 1;

  return createPortal(
    <div
      data-ready="true"
      role="dialog"
      aria-modal="true"
      aria-label={say(RECIPES.cookingTitle, { title })}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--page)]"
    >
      <header className="shrink-0 border-b border-[var(--accent-line)] bg-[var(--band)] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-xs text-slate-500">
              {page === 0
                ? say(RECIPES.ingredientsHeading)
                : say(RECIPES.stepOfTotal, { number: page, total: steps.length })}
            </p>
          </div>
          <Link
            href={`/recipes/${recipeId}`}
            aria-label={say(APP.close)}
            className="pressable shrink-0 rounded-lg p-2 text-slate-400 active:scale-90 hover:bg-slate-200 hover:text-slate-900"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </Link>
        </div>

        {/* The same number is in words above it, so this is decoration — but decoration
            that has to be honest, hence `data-progress`. */}
        <div aria-hidden="true" className="h-1 w-full bg-[var(--band)]">
          <div
            data-progress={progress}
            className="h-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </header>

      {timers.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-2">
          {timers.map((timer) => {
            const remaining = (timer.endsAt - now) / 1000;
            const finished = remaining <= 0;
            return (
              <button
                key={timer.step}
                type="button"
                onClick={() => stopTimer(timer.step)}
                className={`pressable rounded-full px-3 py-1 text-xs font-medium tabular-nums active:scale-[0.96] ${
                  finished ? "bg-emerald-600 text-white" : "accent-tint-bg text-slate-700"
                }`}
              >
                {say(RECIPES.stepNumber, { number: timer.step + 1 })} ·{" "}
                {finished ? say(RECIPES.timerDone) : clockLabel(remaining)}
              </button>
            );
          })}
        </div>
      )}

      {/* `touch-pan-y` leaves vertical scrolling to the browser: a step longer than the
          screen still scrolls, and only a sideways drag turns the page. The key is what
          replays the turn — an animation runs on mount, not on a class changing. */}
      <main
        key={page}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className={`min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-[max(1.25rem,env(safe-area-inset-left))] py-6 pr-[max(1.25rem,env(safe-area-inset-right))] ${
          turn === "next"
            ? "animate-page-turn-next"
            : turn === "back"
              ? "animate-page-turn-back"
              : ""
        }`}
      >
        {page === 0 && (
          <MiseEnPlace
            title={title}
            ingredients={ingredients}
            prepared={prepared}
            recipeId={recipeId}
            prepareAction={prepareAction}
            hasSteps={steps.length > 0}
            language={language}
          />
        )}

        {step && (
          <StepPage
            number={page}
            step={step}
            running={timers.some((timer) => timer.step === page - 1)}
            onStartTimer={(minutes) => startTimer(page - 1, minutes)}
            language={language}
          />
        )}
      </main>

      <footer className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="secondary" onClick={page === 0 ? leave : back} className="flex-1">
          {page === 0 ? say(APP.close) : say(RECIPES.backButton)}
        </Button>
        <Button onClick={forward} className="flex-[2]">
          {page === 0 && !isLastStep
            ? say(RECIPES.start)
            : isLastStep
              ? say(RECIPES.complete)
              : say(RECIPES.next)}
        </Button>
      </footer>
    </div>,
    document.body,
  );
}

/** The page before the cooking: everything that has to be out on the counter. */
function MiseEnPlace({
  title,
  ingredients,
  prepared,
  recipeId,
  prepareAction,
  hasSteps,
  language,
}: {
  title: string;
  ingredients: string[];
  prepared: boolean;
  recipeId: string;
  prepareAction: FormAction;
  hasSteps: boolean;
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
      <h2 className="mt-6 mb-3 text-sm font-semibold text-slate-500 uppercase">
        {say(RECIPES.ingredientsHeading)}
      </h2>
      {ingredients.length === 0 ? (
        <p className="text-sm text-slate-500">{say(RECIPES.noneListed)}</p>
      ) : (
        <ul className="space-y-2 text-base">
          {ingredients.map((line, index) => (
            <li key={index} className="flex gap-2.5">
              <span className="text-slate-400">·</span>
              {line}
            </li>
          ))}
        </ul>
      )}

      {hasSteps && !prepared && (
        <PrepareOffer recipeId={recipeId} action={prepareAction} language={language} />
      )}
    </div>
  );
}

/**
 * What a recipe written before action mode existed is offered, and the second chance for
 * one saved while the reader was down.
 *
 * It says what it would do rather than simply doing it: this rewrites the recipe's own
 * steps, which is not something to take on a cook's behalf because they opened a screen.
 */
function PrepareOffer({
  recipeId,
  action,
  language,
}: {
  recipeId: string;
  action: FormAction;
  language: HomeLanguage;
}) {
  const { state, pending, handleSubmit } = useFormAction(action);
  const say = sayIn(language);

  return (
    <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
      <p className="text-sm text-slate-600">{say(RECIPES.notPreparedNotice)}</p>
      <input type="hidden" name="recipeId" value={recipeId} />
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending} className="mt-3">
        {pending ? say(RECIPES.preparing) : say(RECIPES.prepareSteps)}
      </Button>
      {state?.ok === false && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** One step, and only what it needs. */
function StepPage({
  number,
  step,
  running,
  onStartTimer,
  language,
}: {
  number: number;
  step: CookStep;
  running: boolean;
  onStartTimer: (minutes: number) => void;
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-semibold text-[var(--accent)]">{say(RECIPES.stepNumber, { number })}</p>
      <p className="mt-3 text-xl leading-relaxed break-words">{step.text}</p>

      {step.minutes !== null && (
        <button
          type="button"
          onClick={() => onStartTimer(step.minutes as number)}
          className="pressable accent-tint-ring mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium active:scale-[0.96]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2M9 2h6" strokeLinecap="round" />
          </svg>
          {say(running ? RECIPES.restartTimer : RECIPES.startTimer, {
            time: timeLabel(step.minutes, language) ?? "",
          })}
        </button>
      )}

      {/* A step that uses nothing says nothing: an empty heading reading "none" is a
          line a cook has to read to find out it was not worth reading. */}
      {step.ingredients.length > 0 && (
        <div className="accent-tint-bg mt-7 rounded-xl p-4">
          <h2 className="mb-2.5 text-xs font-semibold text-slate-500 uppercase">
            {say(RECIPES.forThisStep)}
          </h2>
          <ul className="space-y-1.5 text-base">
            {step.ingredients.map((line, index) => (
              <li key={index} className="flex gap-2.5">
                <span className="text-slate-400">·</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
