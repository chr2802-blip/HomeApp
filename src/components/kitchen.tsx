"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { clockLabel } from "@/lib/cook";
import {
  attachPush,
  EMPTY_KITCHEN,
  findCook,
  hasTimer,
  pushesToCancel,
  readKitchen,
  saveKitchen,
  stopTimer,
  type CookTimer,
  type Kitchen,
} from "@/lib/cook-session";
import { cancelTimerPushes, requestTimerPush } from "@/lib/cook-timer-client";
import { cheer } from "@/lib/haptics";
import { readPushState, turnOnPush, type PushState } from "@/lib/push-client";
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
  /** Whether to offer turning notifications on beside the timers: shown where this
   *  installation could ring a locked phone and this browser has not been given them. */
  pushOffer: "hidden" | "shown" | "busy";
  enablePush: () => void;
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
  const [pushOffer, setPushOffer] = useState<KitchenState["pushOffer"]>("hidden");
  // What the last reconcile saw, and which timers a push has been asked for this visit —
  // an answer takes a moment, and asking again meanwhile would schedule the timer twice.
  const seen = useRef<CookTimer[] | null>(null);
  const asked = useRef(new Set<string>());
  const latest = useRef(kitchen);

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

  /**
   * The pushes follow the timers, from here rather than from the buttons: a timer starts
   * in action mode and stops from a chip on any page, and one effect watching the list
   * is the only way every one of those is covered (`lib/cook-timer-push.ts` says why a
   * timer needs a push at all).
   */
  const askForPush = useCallback(async (timer: CookTimer) => {
    const portions = findCook(latest.current, timer.recipeId)?.portions ?? null;
    const { id, available } = await requestTimerPush({
      recipeId: timer.recipeId,
      step: timer.step,
      endsAt: timer.endsAt,
      portions,
    });
    if (id) {
      // Stopped or restarted while the question was out: the push is for a timer that no
      // longer exists, so it is taken straight back rather than attached to nothing.
      if (!hasTimer(latest.current, timer)) cancelTimerPushes([id]);
      else setKitchen((current) => attachPush(current, timer, id));
    } else if (available && (await readPushState()) === "off") {
      setPushOffer((offer) => (offer === "hidden" ? "shown" : offer));
    }
  }, []);

  useEffect(() => {
    latest.current = kitchen;
    if (!loaded) return;
    const at = Date.now();
    if (seen.current) cancelTimerPushes(pushesToCancel(seen.current, kitchen.timers, at));
    seen.current = kitchen.timers;
    for (const timer of kitchen.timers) {
      const key = `${timer.recipeId}:${timer.step}:${timer.endsAt}`;
      if (timer.pushId || timer.endsAt <= at || asked.current.has(key)) continue;
      asked.current.add(key);
      void askForPush(timer);
    }
  }, [loaded, kitchen, askForPush]);

  /** Turning notifications on from beside a running timer, and then giving the timers
   *  already counting the push they could not have before. Has to run from a press: a
   *  browser refuses the permission prompt otherwise. */
  const enablePush = useCallback(async () => {
    setPushOffer("busy");
    let state: PushState;
    try {
      state = await turnOnPush();
    } catch {
      state = "off";
    }
    setPushOffer(state === "off" ? "shown" : "hidden");
    if (state !== "on") return;
    const at = Date.now();
    for (const timer of latest.current.timers) {
      if (!timer.pushId && timer.endsAt > at) void askForPush(timer);
    }
  }, [askForPush]);

  const update = useCallback((change: (kitchen: Kitchen, now: number) => Kitchen) => {
    const at = Date.now();
    setNow(at);
    setKitchen((current) => change(current, at));
  }, []);

  const value = useMemo(
    () => ({ kitchen, loaded, now, update, pushOffer, enablePush: () => void enablePush() }),
    [kitchen, loaded, now, update, pushOffer, enablePush],
  );

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
              className="press-button min-w-0 truncate py-2 pl-3.5"
            >
              {label} · {finished ? say(RECIPES.timerDone) : clockLabel(remaining)}
            </Link>
            <button
              type="button"
              aria-label={say(finished ? RECIPES.dismissTimer : RECIPES.stopTimer, { label })}
              onClick={() => update((current) => stopTimer(current, timer.recipeId, timer.step))}
              className="press-icon shrink-0 rounded-full p-2 pr-2.5 opacity-80 hover:opacity-100"
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
