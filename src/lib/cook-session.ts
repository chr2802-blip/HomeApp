/**
 * What is on the stove, kept in this browser so neither a phone throwing the page away
 * nor a cook walking across to a second recipe loses it.
 *
 * Two questions, answered by two lists, because they come apart the moment two dishes
 * are cooked at once:
 *
 * - **`cooks`** — the recipes being cooked, one entry each, saying which page it was on
 *   and for how many. Walking away from one does not end it: coming back to it lands on
 *   the step it was left on. It ends when its last step is completed, or when it has
 *   gone `RESUME_WITHIN_MS` without anything happening.
 * - **`timers`** — belong to the kitchen, not to the screen showing them. A pan of rice
 *   does not stop because somebody went to read the lasagne, so a timer stops only when
 *   it is stopped, and finished ones stay until they are dismissed. Each carries its
 *   recipe's title, so it can say what it is for from any page in the app, even once its
 *   recipe has been completed.
 *
 * A timer is an `endsAt` rather than a countdown, so it survives being written down and
 * read back: time the page spent dead is time the timer kept running.
 *
 * **`open` is the one statement about the screen**: the recipe whose cooking view is
 * showing, set when it mounts and cleared when it unmounts — which a page the phone
 * killed never does. So finding it set on a fresh load means exactly "the phone threw
 * the page away mid-cook", and `ResumeCooking` puts the cook back there. Leaving on
 * purpose clears it and keeps everything else.
 *
 * `localStorage` rather than the IndexedDB the offline queue uses, because losing this is
 * the bug it fixes and not data loss — a browser that refuses storage just cooks the way
 * it did before this existed. Every access is caught for the same reason.
 */

export type CookTimer = { recipeId: string; title: string; step: number; endsAt: number };

export type Cook = {
  recipeId: string;
  title: string;
  /** How many it was being cooked for, where that was not what the recipe is written for
   *  — so a cook coming back comes back to the same amounts. Null for the recipe as
   *  written. */
  portions: number | null;
  page: number;
  savedAt: number;
};

export type Kitchen = { cooks: Cook[]; timers: CookTimer[]; open: string | null };

export const EMPTY_KITCHEN: Kitchen = { cooks: [], timers: [], open: null };

const KEY = "homehub:cook-session";

/** How long after the last thing that happened to a recipe — a page turn, or one of its
 *  timers running out — it is still somebody mid-dinner rather than yesterday's abandoned
 *  one. A finished timer nobody dismissed is let go after the same stretch. */
export const RESUME_WITHIN_MS = 2 * 60 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readPortions(value: unknown): number | null {
  // Nonsense is the recipe as written rather than a reason to throw the cook away.
  return Number.isInteger(value) && (value as number) >= 1 ? (value as number) : null;
}

function readCook(value: unknown): Cook | null {
  if (!isRecord(value)) return null;
  const { recipeId, title, portions, page, savedAt } = value;
  if (typeof recipeId !== "string" || !recipeId) return null;
  if (!Number.isInteger(page) || (page as number) < 0) return null;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  return {
    recipeId,
    title: typeof title === "string" ? title : "",
    portions: readPortions(portions),
    page: page as number,
    savedAt,
  };
}

function readTimer(value: unknown, fallback?: { recipeId: string; title: string }): CookTimer | null {
  if (!isRecord(value)) return null;
  const { step, endsAt } = value;
  const recipeId = typeof value.recipeId === "string" && value.recipeId ? value.recipeId : fallback?.recipeId;
  if (!recipeId) return null;
  if (!Number.isInteger(step) || (step as number) < 0) return null;
  if (typeof endsAt !== "number" || !Number.isFinite(endsAt)) return null;
  const title = typeof value.title === "string" ? value.title : (fallback?.title ?? "");
  return { recipeId, title, step: step as number, endsAt };
}

/** Reads what was stored, trusting none of it: it came from a browser, possibly from an
 *  older build of this app — including the one that kept a single cook and its timers,
 *  which is read as that one cook, still open, so a deploy landing mid-dinner loses
 *  nothing. */
export function parseKitchen(raw: string | null): Kitchen | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  if ("recipeId" in value) {
    const cook = readCook(value);
    if (!cook) return null;
    const timers = Array.isArray(value.timers) ? value.timers : [];
    return {
      cooks: [cook],
      timers: timers.flatMap((timer) => readTimer(timer, cook) ?? []),
      open: cook.recipeId,
    };
  }

  if (!Array.isArray(value.cooks) || !Array.isArray(value.timers)) return null;
  const cooks = value.cooks.flatMap((cook) => readCook(cook) ?? []);
  const timers = value.timers.flatMap((timer) => readTimer(timer) ?? []);
  const open = typeof value.open === "string" && cooks.some((cook) => cook.recipeId === value.open) ? value.open : null;
  return { cooks, timers, open };
}

/** Whether a cook is still worth going back to. A timer of its own still counting always
 *  is; past that, the window runs from whichever came last, the last turn or the last of
 *  its timers. */
export function isResumable(kitchen: Kitchen, cook: Cook, now: number): boolean {
  const own = kitchen.timers.filter((timer) => timer.recipeId === cook.recipeId).map((timer) => timer.endsAt);
  return now - Math.max(cook.savedAt, ...own) < RESUME_WITHIN_MS;
}

/** Lets go of the cooks and the finished timers the window has passed. */
export function prune(kitchen: Kitchen, now: number): Kitchen {
  const cooks = kitchen.cooks.filter((cook) => isResumable(kitchen, cook, now));
  const timers = kitchen.timers.filter((timer) => now - timer.endsAt < RESUME_WITHIN_MS);
  const open = cooks.some((cook) => cook.recipeId === kitchen.open) ? kitchen.open : null;
  if (cooks.length === kitchen.cooks.length && timers.length === kitchen.timers.length && open === kitchen.open) {
    return kitchen;
  }
  return { cooks, timers, open };
}

export function findCook(kitchen: Kitchen, recipeId: string): Cook | undefined {
  return kitchen.cooks.find((cook) => cook.recipeId === recipeId);
}

/** The cooking view for this recipe is showing, on this page: it is on the stove, and it
 *  is the one open. A recipe already being cooked keeps its place in the order. */
export function showCook(kitchen: Kitchen, cook: Omit<Cook, "savedAt">, now: number): Kitchen {
  const entry = { ...cook, savedAt: now };
  const known = kitchen.cooks.some((existing) => existing.recipeId === cook.recipeId);
  return {
    ...kitchen,
    cooks: known
      ? kitchen.cooks.map((existing) => (existing.recipeId === cook.recipeId ? entry : existing))
      : [...kitchen.cooks, entry],
    open: cook.recipeId,
  };
}

/** The cooking view went away on purpose. Nothing on the stove changes. */
export function leaveCook(kitchen: Kitchen, recipeId: string): Kitchen {
  return kitchen.open === recipeId ? { ...kitchen, open: null } : kitchen;
}

/** A recipe taken off the stove — its last step completed. Its timers stay: the last step
 *  is as often "bake for 40 minutes" as anything, and completing it is how the cook
 *  leaves the screen while that runs. */
export function finishCook(kitchen: Kitchen, recipeId: string): Kitchen {
  return {
    ...kitchen,
    cooks: kitchen.cooks.filter((cook) => cook.recipeId !== recipeId),
    open: kitchen.open === recipeId ? null : kitchen.open,
  };
}

/** Opens a recipe on the stove at a page of its own — a timer pressed on another
 *  recipe's screen goes to the step that timer is for, not wherever that recipe was left.
 *  A recipe no longer on the stove is left to start from its ingredients. */
export function turnCook(kitchen: Kitchen, recipeId: string, page: number): Kitchen {
  if (!findCook(kitchen, recipeId)) return kitchen;
  return {
    ...kitchen,
    cooks: kitchen.cooks.map((cook) => (cook.recipeId === recipeId ? { ...cook, page } : cook)),
  };
}

/** One timer per step of a recipe: starting it again restarts it, which is what somebody
 *  who has just put the potatoes back on means by it. */
export function startTimer(
  kitchen: Kitchen,
  timer: { recipeId: string; title: string; step: number; minutes: number },
  now: number,
): Kitchen {
  const { minutes, ...rest } = timer;
  return {
    ...kitchen,
    timers: [
      ...kitchen.timers.filter((running) => !(running.recipeId === timer.recipeId && running.step === timer.step)),
      { ...rest, endsAt: now + minutes * 60_000 },
    ],
  };
}

export function stopTimer(kitchen: Kitchen, recipeId: string, step: number): Kitchen {
  return {
    ...kitchen,
    timers: kitchen.timers.filter((timer) => !(timer.recipeId === recipeId && timer.step === step)),
  };
}

export function readKitchen(now: number = Date.now()): Kitchen {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY_KITCHEN;
  }
  const kitchen = parseKitchen(raw);
  return kitchen ? prune(kitchen, now) : EMPTY_KITCHEN;
}

export function saveKitchen(kitchen: Kitchen) {
  try {
    if (!kitchen.cooks.length && !kitchen.timers.length) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(kitchen));
  } catch {
    // Private mode, a full quota: this visit simply cannot be resumed.
  }
}

/** Everything, on logout: what was on this browser's stove went with the household. */
export function clearCookSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored that could be read either.
  }
}
