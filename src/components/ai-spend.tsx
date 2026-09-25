import type { HomeLanguage } from "@prisma/client";
import {
  AI_TIMING_WINDOW_DAYS,
  MONTHLY_LIMIT_DKK,
  formatDkk,
  getAiCallTimings,
  getHomeAiSpend,
  getInstallationAiSpend,
} from "@/lib/ai-usage";
import { Card, EmptyState } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { HomeDot } from "@/components/home-dot";
import { sayIn } from "@/lib/copy/say";
import { AI_SPEND, AI_TIMES } from "@/lib/copy/admin";

/**
 * What the app's one AI feature — reading an imported recipe — is costing, against the
 * 5 USD a home may spend in a calendar month.
 *
 * Drawn with the same `ProgressBar` a list uses for what has been ticked off: this is
 * the same kind of thing, a household's own progress towards a total, so it wears that
 * household's `--accent` rather than a colour of its own. Going over the limit changes
 * no colour the bar itself wears — that stays the home's — it is said in words instead,
 * the way an overdue task is said in words beside a bar that never turns red either.
 */

/** The line under the bar: what has been spent, out of what the month allows. */
function SpendLine({ costDkk, language }: { costDkk: number; language: HomeLanguage }) {
  const say = sayIn(language);
  const over = costDkk > MONTHLY_LIMIT_DKK;
  return (
    <p className={`mt-1.5 text-sm ${over ? "text-red-600" : "text-slate-600"}`}>
      {say(AI_SPEND.spendLine, { spent: formatDkk(costDkk), limit: formatDkk(MONTHLY_LIMIT_DKK) })}
      {over && say(AI_SPEND.overTheLimit)}
    </p>
  );
}

function Footnote({ language }: { language: HomeLanguage }) {
  return <p className="mt-3 text-xs text-slate-500">{sayIn(language)(AI_SPEND.footnote)}</p>;
}

/** One household's own AI spend, on its Settings page. */
export async function AiSpendUsage({ homeId, language }: { homeId: string; language: HomeLanguage }) {
  const spend = await getHomeAiSpend(homeId);

  return (
    <Card>
      <ProgressBar done={spend.costDkk} total={MONTHLY_LIMIT_DKK} />
      <SpendLine costDkk={spend.costDkk} language={language} />
      <Footnote language={language} />
    </Card>
  );
}

/** Every home's AI spend this month, on the super admin's System page. */
export async function AiSpendAcrossHomes({ language }: { language: HomeLanguage }) {
  const { homes } = await getInstallationAiSpend();
  const say = sayIn(language);

  if (homes.length === 0) {
    return <EmptyState>{say(AI_SPEND.noHomesYet)}</EmptyState>;
  }

  return (
    <>
      <Card className="divide-y divide-slate-100 p-0">
        {homes.map((home) => (
          // The home's own colour, the same way a listed home's dot wears it — a
          // wrapper carrying `data-theme` rather than a colour read off a prop, so six
          // homes on one page can each be in their own colour at once.
          <div key={home.id} data-theme={home.theme} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <HomeDot theme={home.theme} />
              <p className="min-w-0 flex-1 truncate font-medium">{home.name}</p>
              <span
                className={`shrink-0 text-sm tabular-nums ${
                  home.costDkk > MONTHLY_LIMIT_DKK ? "text-red-600" : "text-slate-600"
                }`}
              >
                {formatDkk(home.costDkk)}
              </span>
            </div>
            <ProgressBar done={home.costDkk} total={MONTHLY_LIMIT_DKK} className="mt-2.5" />
          </div>
        ))}
      </Card>
      <Footnote language={language} />
    </>
  );
}

/** What each recorded `feature` is called on the page; one it does not know shows as recorded. */
const FEATURE_NAME = {
  recipe_import: AI_TIMES.import,
  cook_steps: AI_TIMES.save,
  pantry_sort: AI_TIMES.pantrySort,
} as const;

/** Seconds to one decimal, with the decimal mark the household's own language writes. */
function seconds(ms: number, language: HomeLanguage): string {
  const s = new Intl.NumberFormat(language === "DA" ? "da-DK" : "en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ms / 1000);
  return sayIn(language)(AI_TIMES.seconds, { s });
}

/** How long each AI reader has kept the household waiting, per model, on the System page. */
export async function AiCallTimes({ language }: { language: HomeLanguage }) {
  const timings = await getAiCallTimings();
  const say = sayIn(language);

  return (
    <>
      {timings.length === 0 ? (
        <EmptyState>{say(AI_TIMES.noneYet, { days: AI_TIMING_WINDOW_DAYS })}</EmptyState>
      ) : (
        <Card className="divide-y divide-slate-100 p-0">
          {timings.map((row) => {
            const name = FEATURE_NAME[row.feature as keyof typeof FEATURE_NAME];
            return (
              <div key={`${row.feature}-${row.model}`} className="px-4 py-3" data-timing={row.feature}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="font-medium">{name ? say(name) : row.feature}</p>
                  <p className="min-w-0 flex-1 truncate text-xs text-slate-500">{row.model}</p>
                  <span className="shrink-0 text-sm text-slate-500 tabular-nums">
                    {say(AI_TIMES.calls, { count: row.calls })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 tabular-nums">
                  {say(AI_TIMES.typicalAndSlowest, {
                    typical: seconds(row.typicalMs, language),
                    slowest: seconds(row.slowestMs, language),
                  })}
                </p>
              </div>
            );
          })}
        </Card>
      )}
      <p className="mt-3 text-xs text-slate-500">{say(AI_TIMES.footnote, { days: AI_TIMING_WINDOW_DAYS })}</p>
    </>
  );
}
