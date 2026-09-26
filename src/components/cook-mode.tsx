"use client";

import type { HomeLanguage } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { clockLabel, type CookStep } from "@/lib/cook";
import { finishCook, findCook, leaveCook, showCook, startTimer, stopTimer } from "@/lib/cook-session";
import { cheer, tick } from "@/lib/haptics";
import { PORTIONS_PARAM, timeLabel } from "@/lib/recipes";
import type { FormAction } from "@/lib/action-result";
import { Button } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { useWakeLock } from "@/components/use-wake-lock";
import { cookHref, useKitchen } from "@/components/kitchen";
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
 * **The timers are not its own.** They belong to the kitchen (`components/kitchen.tsx`),
 * so leaving this screen — for the other recipe on the stove, the shopping list, anything
 * — leaves them running, and this screen draws every one of them, the other recipes'
 * too, each a way over to the recipe it is for.
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

export function CookMode({
  recipeId,
  title,
  steps,
  ingredients,
  prepared,
  prepareAction,
  portions,
  servings,
}: {
  recipeId: string;
  title: string;
  steps: CookStep[];
  ingredients: string[];
  prepared: boolean;
  prepareAction: FormAction;
  /** How many this is being cooked for, where that is not what the recipe is written
   *  for — the amounts arrive already scaled; this is only for saying so, and for taking
   *  the same number back to the recipe page. */
  portions: number | null;
  /** How many the recipe is written for, or null where nobody has said. */
  servings: number | null;
}) {
  const router = useRouter();
  const recipeHref = `/recipes/${recipeId}${portions !== null ? `?${PORTIONS_PARAM}=${portions}` : ""}`;
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

  const { kitchen, loaded, now, update } = useKitchen();

  // The screen stays on for as long as this is open. Nothing to press: somebody who has
  // opened the cooking view has already said what they are doing for the next half hour.
  useWakeLock(mounted);

  // Picking up where this recipe was left — by a phone that discarded the page, or by a
  // cook who went to see to another recipe (see `lib/cook-session.ts`). Read once the
  // kitchen has been, and before the first real render, so the surface never shows the
  // ingredients page and then jumps.
  useEffect(() => {
    if (!loaded || mounted) return;
    const saved = findCook(kitchen, recipeId);
    if (saved) setPage(Math.min(saved.page, pageCount - 1));
    setMounted(true);
    // Once, on arrival: what is stored afterwards is this visit's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // On the stove, open, and on this page — said on every turn, so coming back finds it.
  useEffect(() => {
    if (!mounted) return;
    update((current, at) => showCook(current, { recipeId, title, portions, page }, at));
  }, [mounted, update, recipeId, title, portions, page]);

  // Leaving — Close, the back gesture, the other recipe — unmounts this and says the
  // screen is no longer open, and nothing else: the recipe stays on the stove and its
  // timers keep counting. A page the phone killed never runs this, which is how a fresh
  // load tells the two apart.
  useEffect(() => () => update((current) => leaveCook(current, recipeId)), [update, recipeId]);

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

  const leave = useCallback(() => router.push(recipeHref), [router, recipeHref]);

  // The last page turns nowhere — turning past it is finishing, so it closes the mode
  // instead of moving to one more screen that only exists to say so.
  const complete = useCallback(() => {
    cheer();
    update((current) => finishCook(current, recipeId));
    leave();
  }, [leave, update, recipeId]);

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

  function start(step: number, minutes: number) {
    tick();
    update((current, at) => startTimer(current, { recipeId, title, step, minutes }, at));
  }

  function stop(step: number) {
    update((current) => stopTimer(current, recipeId, step));
  }

  // This recipe's own first, in the order they were started, then everybody else's — a
  // step past the end of this recipe is a timer from before it was edited, and is not
  // drawn as though it were one of these steps.
  const own = kitchen.timers.filter((timer) => timer.recipeId === recipeId && timer.step < steps.length);
  const others = kitchen.timers.filter((timer) => timer.recipeId !== recipeId);

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
            href={recipeHref}
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

      {own.length + others.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-2">
          {/* This recipe's own stop when pressed, as they always have; another recipe's
              is a way over to it, where pressing it stops it. */}
          {[...own, ...others].map((timer) => {
            const remaining = (timer.endsAt - now) / 1000;
            const finished = remaining <= 0;
            const step = say(RECIPES.stepNumber, { number: timer.step + 1 });
            const mine = timer.recipeId === recipeId;
            const label = mine || !timer.title ? step : say(RECIPES.timerOf, { title: timer.title, step });
            const className = `pressable max-w-full truncate rounded-full px-3 py-1 text-xs font-medium tabular-nums active:scale-[0.96] ${
              finished ? "bg-emerald-600 text-white" : mine ? "accent-tint-bg text-slate-700" : "bg-slate-100 text-slate-700"
            }`;
            const text = (
              <>
                {label} · {finished ? say(RECIPES.timerDone) : clockLabel(remaining)}
              </>
            );
            return mine ? (
              <button key={`${timer.recipeId}:${timer.step}`} type="button" onClick={() => stop(timer.step)} className={className}>
                {text}
              </button>
            ) : (
              <Link key={`${timer.recipeId}:${timer.step}`} href={cookHref(kitchen, timer.recipeId)} replace className={className}>
                {text}
              </Link>
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
            portions={portions ?? servings}
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
            running={own.some((timer) => timer.step === page - 1)}
            onStartTimer={(minutes) => start(page - 1, minutes)}
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
  portions,
}: {
  title: string;
  ingredients: string[];
  portions: number | null;
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
        {portions !== null && (
          <span data-testid="cook-portions" className="font-normal normal-case">
            {" · "}
            {say(RECIPES.portions, { count: portions })}
          </span>
        )}
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
