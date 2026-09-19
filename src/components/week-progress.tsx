import { Card } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { streakLine, type Streak } from "@/lib/streak";
import type { WeekWork } from "@/lib/week";

/**
 * How the household's week is going: the jobs it has got through, and how long it has
 * been clearing a list a week.
 *
 * This replaced a line that said "N tasks completed in the last 7 days". The number was
 * true and told nobody anything: a household that does eight jobs a week and one that
 * does thirty both read it as a number with no top. A proportion has a top, so it says
 * whether the week is under control.
 *
 * **The denominator is the week's own work, not the household's whole task list.**
 * Which tasks those are, and which side of the bar each falls on, is `weekWorkload` in
 * `lib/week.ts` — counting every task in the home would put the annual boiler service
 * in the denominator of a shopping week.
 *
 * It stays the household's rhythm and not a person's, which is the same choice the
 * streak makes and the reason neither says who. A weekly score with names on it turns
 * the washing-up into a thing worth being seen to do.
 */
export function WeekProgress({ week, streak }: { week: WeekWork; streak: Streak }) {
  const { done, outstanding } = week;
  const total = done + outstanding;

  // Nothing to say rather than a card saying nothing: a household with no tasks due and
  // nothing cleared has not had a quiet week, it has not started using the app.
  if (total === 0 && streak.weeks === 0) return null;

  return (
    <Card className="mb-6 space-y-3 py-4">
      {total > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium text-slate-600">
              {outstanding === 0
                ? `This week · all ${done} done`
                : `This week · ${done} of ${total} jobs done`}
            </span>
            <span className="tabular-nums text-slate-400">
              {Math.round((done / total) * 100)}%
            </span>
          </div>
          <ProgressBar done={done} total={total} />
        </div>
      )}

      {streak.weeks > 0 && <p className="text-xs text-slate-500">{streakLine(streak)}</p>}
    </Card>
  );
}
