"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { clockLabel } from "@/lib/cook";
import { EMPTY_KITCHEN, findCook, readKitchen, saveKitchen, stopTimer, type Kitchen } from "@/lib/cook-session";
import { cheer } from "@/lib/haptics";
import { PORTIONS_PARAM } from "@/lib/recipes";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { useLanguage } from "@/components/language-provider";

/**
 * The kitchen: every recipe on the stove and every timer running, held above the pages.
 *
 * The cooking view used to hold its timers in its own state, so walking from one recipe
 * to another — two dishes at once, which is most dinners — ended the first one's timers
 * the moment its screen went away. Held here, in the app layout, a timer outlives every
 * screen: it counts, and buzzes when it runs out, wherever in the app the cook happens to
 * be. What it all means is `lib/cook-session.ts`'s to say; this only keeps it in React
 * and writes every change through to the browser's storage.
 */

type KitchenState = {
  kitchen: Kitchen;
  /** False until the browser's storage has been read. Nothing should be drawn from, or
   *  written over, a kitchen that has not been read yet. */
  loaded: boolean;
  now: number;
  update: (change: (kitchen: Kitchen, now: number) => Kitchen) => void;
};

const KitchenContext = createContext<KitchenState | null>(null);

export function useKitchen(): KitchenState {
  const state = useContext(KitchenContext);
  if (!state) throw new Error("useKitchen is used outside KitchenProvider");
  return state;
}

export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [kitchen, setKitchen] = useState<Kitchen>(EMPTY_KITCHEN);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const rung = useRef(new Set<string>());

  useEffect(() => {
    setKitchen(readKitchen());
    setLoaded(true);
  }, []);

  // Written on every change, because a page that is about to be discarded is given no
  // warning a phone reliably honours.
  useEffect(() => {
    if (loaded) saveKitchen(kitchen);
  }, [loaded, kitchen]);

  // Only while something is counting: an interval left running behind nothing is a phone
  // kept awake for nothing.
  const counting = kitchen.timers.length > 0;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [counting]);

  // A timer reaching zero is worth feeling, once, whichever screen is showing. `rung` is a
  // ref rather than state because noticing must not itself cause the render that would
  // notice again.
  useEffect(() => {
    for (const timer of kitchen.timers) {
      const key = `${timer.recipeId}:${timer.step}:${timer.endsAt}`;
      if (timer.endsAt <= now && !rung.current.has(key)) {
        rung.current.add(key);
        cheer();
      }
    }
  }, [kitchen.timers, now]);

  const update = useCallback((change: (kitchen: Kitchen, now: number) => Kitchen) => {
    const at = Date.now();
    setNow(at);
    setKitchen((current) => change(current, at));
  }, []);

  const value = useMemo(() => ({ kitchen, loaded, now, update }), [kitchen, loaded, now, update]);

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}

/** The cooking view's own address, carrying the amounts that recipe was being cooked for. */
export function cookHref(kitchen: Kitchen, recipeId: string): string {
  const portions = findCook(kitchen, recipeId)?.portions ?? null;
  return `/recipes/${recipeId}/cook${portions !== null ? `?${PORTIONS_PARAM}=${portions}` : ""}`;
}

const COOK_PATH = /^\/recipes\/[^/]+\/cook$/;

/**
 * The timers, on every page but the cooking view (which draws its own): a row of chips
 * above the tab bar, each one naming its recipe and step, going back to that recipe when
 * pressed and stopping — or, once it has run out, dismissed — by its cross.
 */
export function KitchenTimers() {
  const { kitchen, loaded, now, update } = useKitchen();
  const pathname = usePathname();
  const say = sayIn(useLanguage());

  if (!loaded || !kitchen.timers.length || COOK_PATH.test(pathname)) return null;

  return (
    <div
      role="region"
      aria-label={say(RECIPES.timersRegion)}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 flex flex-wrap justify-center gap-2 px-4 md:bottom-4"
    >
      {kitchen.timers.map((timer) => {
        const remaining = (timer.endsAt - now) / 1000;
        const finished = remaining <= 0;
        const step = say(RECIPES.stepNumber, { number: timer.step + 1 });
        const label = timer.title ? say(RECIPES.timerOf, { title: timer.title, step }) : step;
        return (
          <div
            key={`${timer.recipeId}:${timer.step}`}
            data-testid="kitchen-timer"
            className={`pointer-events-auto flex max-w-full items-center rounded-full text-xs font-medium tabular-nums shadow-md ${
              finished ? "bg-emerald-600 text-white" : "bg-[var(--accent)] text-white"
            }`}
          >
            <Link
              href={cookHref(kitchen, timer.recipeId)}
              className="pressable min-w-0 truncate py-2 pl-3.5 active:scale-[0.96]"
            >
              {label} · {finished ? say(RECIPES.timerDone) : clockLabel(remaining)}
            </Link>
            <button
              type="button"
              aria-label={say(finished ? RECIPES.dismissTimer : RECIPES.stopTimer, { label })}
              onClick={() => update((current) => stopTimer(current, timer.recipeId, timer.step))}
              className="pressable shrink-0 rounded-full p-2 pr-2.5 opacity-80 hover:opacity-100 active:scale-90"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
