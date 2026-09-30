import type { HomeLanguage } from "@prisma/client";
import type { WeekWork } from "@/lib/week";
import { sayIn } from "@/lib/copy/say";
import { DASHBOARD } from "@/lib/copy/dashboard";

/** The ring's circumference in its own 36-unit viewBox: 2π × 15.5. */
const CIRCUMFERENCE = 97.4;

/**
 * How the household's week is going, as a ring beside the greeting.
 *
 * This replaced a line that said "N tasks completed in the last 7 days". The number was
 * true and told nobody anything: a household that does eight jobs a week and one that
 * does thirty both read it as a number with no top. A proportion has a top, so it says
 * whether the week is under control.
 *
 * **The denominator is the week's own work, not the household's whole task list.**
 * Which tasks those are, and which side of the ring each falls on, is `weekWorkload` in
 * `lib/week.ts` — counting every task in the home would put the annual boiler service
 * in the denominator of a shopping week.
 *
 * **A ring in the header rather than a card of its own.** It was a full-width card with
 * a bar and a sentence, the first block on the page and the one asking least of anybody;
 * beside the greeting it costs no height at all. The sentence it used to print is still
 * here for a screen reader, and the drawing is `aria-hidden` — the same split every
 * chart in the app makes.
 *
 * It stays the household's rhythm and not a person's, which is the same choice the
 * streak makes and the reason neither says who. A weekly score with names on it turns
 * the washing-up into a thing worth being seen to do. The fill is the home's `--accent`
 * on the `--band` track, because this is the household's own progress.
 */
export function WeekRing({ week, language }: { week: WeekWork; language: HomeLanguage }) {
  const say = sayIn(language);
  const { done, outstanding } = week;
  const total = done + outstanding;

  // Nothing to say rather than a ring of nothing: a household with no work this week
  // has not had a quiet week, it has not started using the app.
  if (total === 0) return null;

  return (
    // A whole week done is the one moment on this page worth a flourish: the ring
    // bounces once as the page arrives and the fraction becomes the house, which is
    // what all those jobs were for. Once — `animate-week-done` does not repeat.
    <div className={`relative h-16 w-16 shrink-0 ${outstanding === 0 ? "animate-week-done" : ""}`}>
      <span className="sr-only">
        {outstanding === 0
          ? say(DASHBOARD.weekAllDone, { done })
          : say(DASHBOARD.weekOfTotalDone, { done, total })}
      </span>
      <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-slate-200)" strokeWidth="3.5" />
        {done > 0 && (
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${(done / total) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        )}
      </svg>
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center leading-none"
      >
        {outstanding === 0 ? (
          <span className="text-2xl">🏡</span>
        ) : (
          <>
            <span className="text-sm font-semibold tabular-nums">
              {done}/{total}
            </span>
            <span className="mt-0.5 text-[9px] text-slate-500">{say(DASHBOARD.jobs)}</span>
          </>
        )}
      </div>
    </div>
  );
}
