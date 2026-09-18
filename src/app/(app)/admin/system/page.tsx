import { requireSuperAdmin } from "@/lib/auth";
import { getHealth, REMINDER_STALE_AFTER_HOURS, METRIC_RETENTION_DAYS } from "@/lib/observability";
import { getSystemStats } from "@/lib/system-stats";
import { formatInZone } from "@/lib/time";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE = { ok: "green", degraded: "amber", down: "red" } as const;
const VERDICT = {
  ok: "Everything looks healthy",
  degraded: "Running, but something needs attention",
  down: "The database cannot be reached",
} as const;

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export default async function SystemPage() {
  await requireSuperAdmin();

  const now = new Date();
  const [health, stats] = await Promise.all([getHealth(now), getSystemStats(now)]);
  const { totals, recentRuns, slowQueries, slowQueryThresholdMs } = stats;

  return (
    <>
      <PageHeader
        title="System"
        description="How the installation itself is doing."
        action={
          <ButtonLink href="/admin" variant="secondary">
            Back to admin
          </ButtonLink>
        }
      />

      <Card className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={TONE[health.status]}>{health.status}</Badge>
            <p className="font-medium">{VERDICT[health.status]}</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {health.environment} · database{" "}
            {health.database.reachable
              ? `reachable in ${health.database.latencyMs} ms`
              : "unreachable"}
          </p>
        </div>
      </Card>

      {/* What is actually live. Drawn only where there is a commit to name: on a laptop
          there is no deployment, and an empty card saying so would be furniture. */}
      {health.deployment.version && (
        <Card className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase">Deployed</h2>
          <p className="mt-2 font-medium break-words">
            {health.deployment.message ?? "No commit message recorded."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {health.deployment.url ? (
              <a
                href={health.deployment.url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono underline underline-offset-2"
              >
                {health.deployment.version}
              </a>
            ) : (
              <span className="font-mono">{health.deployment.version}</span>
            )}
            {health.deployment.ref ? ` · ${health.deployment.ref}` : ""}
          </p>
          {/* Only main deploys — vercel.json disables every other branch — so a build
              from anywhere else is worth seeing rather than reading past. */}
          {health.deployment.ref && health.deployment.ref !== "main" && (
            <p className="mt-2 text-xs text-amber-700">
              This build did not come from main.
            </p>
          )}
        </Card>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Reminders</h2>

        {health.reminders.lastRunAt === null ? (
          <EmptyState>
            The reminder job has not run yet. It runs once each morning; if nothing appears here
            tomorrow, the schedule is not reaching the app.
          </EmptyState>
        ) : (
          <Card className="mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={health.reminders.stale ? "red" : health.reminders.ok ? "green" : "amber"}>
                {health.reminders.stale ? "overdue" : health.reminders.ok ? "on schedule" : "failed"}
              </Badge>
              <p className="font-medium">
                Last run {formatInZone(health.reminders.lastRunAt, "d MMM 'at' HH:mm")}
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {health.reminders.ageHours} hours ago.{" "}
              {health.reminders.stale
                ? `Expected at least once every ${REMINDER_STALE_AFTER_HOURS} hours — reminders are probably not going out.`
                : "Reminders are going out as scheduled."}
            </p>
            {health.reminders.error && (
              <p className="mt-2 text-sm text-red-600">
                Last error: {health.reminders.error}
              </p>
            )}
          </Card>
        )}

        {recentRuns.length > 0 && (
          <Card className="divide-y divide-slate-100 p-0">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-40 shrink-0 text-slate-500">
                  {formatInZone(run.startedAt, "d MMM HH:mm")}
                </span>
                <Badge tone={run.finishedAt === null ? "amber" : run.ok ? "green" : "red"}>
                  {run.finishedAt === null ? "did not finish" : run.ok ? "ok" : "failed"}
                </Badge>
                <span className="text-slate-600">
                  {run.tasksDue} due · {run.notificationsSent} sent
                </span>
                {run.error && <span className="text-red-600">{run.error}</span>}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Content</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Homes" value={totals.homes} />
          <Stat label="People" value={totals.users} />
          <Stat
            label="Notifications on"
            value={totals.subscriptions}
            hint={`across ${totals.users} ${totals.users === 1 ? "person" : "people"}`}
          />
          <Stat label="Tasks overdue" value={totals.overdue} hint={`of ${totals.tasks} tasks`} />
          <Stat label="Lists" value={totals.lists} />
          <Stat label="Recipes" value={totals.recipes} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Slowest database calls</h2>
        {slowQueries.length === 0 ? (
          <EmptyState>
            Nothing took longer than {slowQueryThresholdMs} ms in the last day.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {slowQueries.map((entry) => (
              <div
                key={`${entry.model}-${entry.operation}`}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 font-medium">
                  {entry.model ?? "raw"}.{entry.operation}
                </span>
                <span className="text-slate-500">{entry._count._all}×</span>
                <Badge tone={(entry._max.durationMs ?? 0) > slowQueryThresholdMs * 4 ? "red" : "amber"}>
                  {entry._max.durationMs} ms worst
                </Badge>
              </div>
            ))}
          </Card>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Calls over {slowQueryThresholdMs} ms are recorded and kept for {METRIC_RETENTION_DAYS} days.
          Failed requests are written to the platform logs rather than stored here.
        </p>
      </section>

      {/* An installed app has no address bar, so a page reachable only by typing its
          path is a page nobody on a phone can open. This is the way in, and it is here
          because this is where the deployment is inspected — and it goes when the
          readout does. */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">This device</h2>
        <Card>
          <p className="text-sm text-slate-500">
            What the phone reports about the frame — whether the app is drawn under the
            status bar, and what colour it was told to paint.
          </p>
          <ButtonLink href="/bars" variant="secondary" className="mt-3">
            Bars
          </ButtonLink>
        </Card>
      </section>
    </>
  );
}
