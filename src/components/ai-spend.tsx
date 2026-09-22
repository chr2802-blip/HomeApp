import type { HomeLanguage } from "@prisma/client";
import {
  MONTHLY_LIMIT_DKK,
  formatDkk,
  getHomeAiSpend,
  getInstallationAiSpend,
} from "@/lib/ai-usage";
import { Card, EmptyState } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { HomeDot } from "@/components/home-dot";
import { sayIn } from "@/lib/copy/say";
import { AI_SPEND } from "@/lib/copy/admin";

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
