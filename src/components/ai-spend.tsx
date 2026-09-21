import {
  MONTHLY_LIMIT_DKK,
  formatDkk,
  getHomeAiSpend,
  getInstallationAiSpend,
} from "@/lib/ai-usage";
import { Card, EmptyState } from "@/components/ui";
import { ProgressBar } from "@/components/progress-bar";
import { HomeDot } from "@/components/home-dot";

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
function SpendLine({ costDkk }: { costDkk: number }) {
  const over = costDkk > MONTHLY_LIMIT_DKK;
  return (
    <p className={`mt-1.5 text-sm ${over ? "text-red-600" : "text-slate-600"}`}>
      {formatDkk(costDkk)} of {formatDkk(MONTHLY_LIMIT_DKK)} this month
      {over && " — over the limit"}
    </p>
  );
}

function Footnote() {
  return (
    <p className="mt-3 text-xs text-slate-500">
      What Anthropic billed for reading imported recipes this calendar month, converted
      from its own price in USD at a fixed rate. Resets on the first of the month.
    </p>
  );
}

/** One household's own AI spend, on its Settings page. */
export async function AiSpendUsage({ homeId }: { homeId: string }) {
  const spend = await getHomeAiSpend(homeId);

  return (
    <Card>
      <ProgressBar done={spend.costDkk} total={MONTHLY_LIMIT_DKK} />
      <SpendLine costDkk={spend.costDkk} />
      <Footnote />
    </Card>
  );
}

/** Every home's AI spend this month, on the super admin's System page. */
export async function AiSpendAcrossHomes() {
  const { homes } = await getInstallationAiSpend();

  if (homes.length === 0) {
    return <EmptyState>No homes yet.</EmptyState>;
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
      <Footnote />
    </>
  );
}
