/**
 * Where a cook was, kept in this browser so a phone that throws the page away can put
 * them back.
 *
 * A phone left on another app for half an hour is allowed to discard the page, and iOS
 * does: an installed app is then relaunched at the manifest's `start_url` — the
 * dashboard — and everything action mode held in React state, the page and the running
 * timers, is gone. A timer is an `endsAt` rather than a countdown, so it survives being
 * written down and read back: time the page spent dead is time the timer kept running.
 *
 * `localStorage` rather than the IndexedDB the offline queue uses, because losing this is
 * the bug it fixes and not data loss — a browser that refuses storage just cooks the way
 * it did before this existed. Every access is caught for the same reason.
 *
 * It is cleared by leaving action mode on purpose (the component unmounting), which a
 * page that is killed never does — so a saved session *is* the statement "this cook did
 * not leave".
 */

export type CookTimer = { step: number; endsAt: number };

export type CookSession = {
  recipeId: string;
  page: number;
  timers: CookTimer[];
  savedAt: number;
};

const KEY = "homehub:cook-session";

/** How long after the last thing that happened — a page turn, or a timer running out —
 *  a session is still somebody mid-dinner rather than yesterday's abandoned one. */
export const RESUME_WITHIN_MS = 2 * 60 * 60_000;

/** Reads what was stored, trusting none of it: it came from a browser, possibly from an
 *  older build of this app. */
export function parseCookSession(raw: string | null): CookSession | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { recipeId, page, timers, savedAt } = value as Record<string, unknown>;
  if (typeof recipeId !== "string" || !recipeId) return null;
  if (!Number.isInteger(page) || (page as number) < 0) return null;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return null;
  if (!Array.isArray(timers)) return null;
  const valid = timers.filter(
    (timer): timer is CookTimer =>
      !!timer &&
      typeof timer === "object" &&
      Number.isInteger(timer.step) &&
      timer.step >= 0 &&
      typeof timer.endsAt === "number" &&
      Number.isFinite(timer.endsAt),
  );
  return { recipeId, page: page as number, timers: valid, savedAt };
}

/** Whether a session is still worth going back to. A timer still counting always is; past
 *  that, the window runs from whichever came last, the last turn or the last timer. */
export function isResumable(session: CookSession, now: number): boolean {
  const lastEvent = Math.max(session.savedAt, ...session.timers.map((timer) => timer.endsAt));
  return now - lastEvent < RESUME_WITHIN_MS;
}

export function readCookSession(now: number = Date.now()): CookSession | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  const session = parseCookSession(raw);
  if (session && isResumable(session, now)) return session;
  if (raw !== null) clearCookSession();
  return null;
}

export function saveCookSession(session: CookSession) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode, a full quota: this visit simply cannot be resumed.
  }
}

export function clearCookSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored that could be read either.
  }
}
