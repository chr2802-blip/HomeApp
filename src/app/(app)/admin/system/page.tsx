import { requireSuperAdmin } from "@/lib/auth";
import { getHealth, REMINDER_STALE_AFTER_HOURS, METRIC_RETENTION_DAYS } from "@/lib/observability";
import { getSystemStats } from "@/lib/system-stats";
import { readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { StorageAcrossHomes } from "@/components/storage-usage";
import { AiCallTimes, AiSpendAcrossHomes } from "@/components/ai-spend";
import { sayIn, type Say } from "@/lib/copy/say";
import { AI_TIMES, SYSTEM } from "@/lib/copy/admin";
import { SETTINGS } from "@/lib/copy/settings";

export const dynamic = "force-dynamic";

const TONE = { ok: "green", degraded: "amber", down: "red" } as const;

function verdictFor(say: Say) {
  return {
    ok: say(SYSTEM.verdictOk),
    degraded: say(SYSTEM.verdictDegraded),
    down: say(SYSTEM.verdictDown),
  } as const;
}

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
  // The installation's own page reads in the super admin's own home's language, the
  // same reading `homeTheme` already gets from the session for the frame around it.
  const user = await requireSuperAdmin();
  const say = sayIn(user.homeLanguage);
  const VERDICT = verdictFor(say);

  const now = new Date();
  const [health, stats] = await Promise.all([getHealth(now), getSystemStats(now)]);
  const { totals, recentRuns, slowQueries, slowQueryThresholdMs } = stats;

  return (
    <>
      <PageHeader
        title={say(SYSTEM.title)}
        description={say(SYSTEM.description)}
        action={
          <ButtonLink href="/admin" variant="secondary">
            {say(SYSTEM.backToAdmin)}
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
            {health.environment} · {say(SYSTEM.database)}{" "}
            {health.database.reachable
              ? say(SYSTEM.reachableIn, { ms: health.database.latencyMs ?? 0 })
              : say(SYSTEM.unreachable)}
          </p>
        </div>
      </Card>

      {/* What is actually live. Drawn only where there is a commit to name: on a laptop
          there is no deployment, and an empty card saying so would be furniture. */}
      {health.deployment.version && (
        <Card className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase">{say(SYSTEM.deployed)}</h2>
          <p className="mt-2 font-medium break-words">
            {health.deployment.message ?? say(SYSTEM.noCommitMessage)}
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
            <p className="mt-2 text-xs text-amber-700">{say(SYSTEM.notFromMain)}</p>
          )}
        </Card>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SYSTEM.remindersHeading)}
        </h2>

        {health.reminders.lastRunAt === null ? (
          <EmptyState>{say(SYSTEM.jobNotRun)}</EmptyState>
        ) : (
          <Card className="mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={health.reminders.stale ? "red" : health.reminders.ok ? "green" : "amber"}>
                {health.reminders.stale
                  ? say(SYSTEM.overdue)
                  : health.reminders.ok
                    ? say(SYSTEM.onSchedule)
                    : say(SYSTEM.failed)}
              </Badge>
              <p className="font-medium">
                {say(SYSTEM.lastRun, {
                  when: readInZone(health.reminders.lastRunAt, DATE.dayAndTime, user.homeLanguage),
                })}
              </p>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {say(SYSTEM.hoursAgo, { hours: health.reminders.ageHours ?? 0 })}{" "}
              {health.reminders.stale
                ? say(SYSTEM.expectedFrequency, { hours: REMINDER_STALE_AFTER_HOURS })
                : say(SYSTEM.goingOutAsScheduled)}
            </p>
            {health.reminders.error && (
              <p className="mt-2 text-sm text-red-600">
                {say(SYSTEM.lastError, { error: health.reminders.error })}
              </p>
            )}
          </Card>
        )}

        {recentRuns.length > 0 && (
          <Card className="divide-y divide-slate-100 p-0">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-40 shrink-0 text-slate-500">
                  {readInZone(run.startedAt, DATE.dayTime, user.homeLanguage)}
                </span>
                <Badge tone={run.finishedAt === null ? "amber" : run.ok ? "green" : "red"}>
                  {run.finishedAt === null ? say(SYSTEM.didNotFinish) : run.ok ? say(SYSTEM.ok) : say(SYSTEM.failed)}
                </Badge>
                <span className="text-slate-600">
                  {say(SYSTEM.dueAndSent, { due: run.tasksDue, sent: run.notificationsSent })}
                </span>
                {run.error && <span className="text-red-600">{run.error}</span>}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SYSTEM.contentHeading)}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label={say(SYSTEM.homes)} value={totals.homes} />
          <Stat label={say(SYSTEM.people)} value={totals.users} />
          <Stat
            label={say(SYSTEM.notificationsOnStat)}
            value={totals.subscriptions}
            hint={say(SYSTEM.acrossPeople, { count: totals.users })}
          />
          <Stat
            label={say(SYSTEM.tasksOverdue)}
            value={totals.overdue}
            hint={say(SYSTEM.ofTasks, { count: totals.tasks })}
          />
          <Stat label={say(SYSTEM.lists)} value={totals.lists} />
          <Stat label={say(SYSTEM.recipes)} value={totals.recipes} />
        </div>
      </section>

      {/* Counts above, size below: how many recipes there are and how much room they
          take are different questions, and the second one is the one that costs money.
          Split by home as well as by kind, because "the database has grown" is only
          actionable once it says which household it grew in. */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.storageHeading)}
        </h2>
        <StorageAcrossHomes language={user.homeLanguage} />
      </section>

      {/* What reading an imported recipe is costing, home by home, against the 5 USD a
          month each is allowed. Beside Storage rather than Content, because both are
          "what is this household using" and this one is measured in money rather than
          bytes or rows. */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.aiSpendingHeading)}
        </h2>
        <AiSpendAcrossHomes language={user.homeLanguage} />
      </section>

      {/* How long each AI reader keeps the household waiting, per model, so a change of
          model or effort is judged from what it did to the wait rather than guessed at. */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">{say(AI_TIMES.heading)}</h2>
        <AiCallTimes language={user.homeLanguage} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SYSTEM.slowestCalls)}
        </h2>
        {slowQueries.length === 0 ? (
          <EmptyState>{say(SYSTEM.nothingSlow, { ms: slowQueryThresholdMs })}</EmptyState>
        ) : (
          <Card className="divide-y divide-slate-100 p-0">
            {slowQueries.map((entry) => (
              <div
                key={`${entry.model}-${entry.operation}`}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 font-medium">
                  {entry.model ?? say(SYSTEM.raw)}.{entry.operation}
                </span>
                <span className="text-slate-500">{entry._count._all}×</span>
                <Badge tone={(entry._max.durationMs ?? 0) > slowQueryThresholdMs * 4 ? "red" : "amber"}>
                  {say(SYSTEM.worstMs, { ms: entry._max.durationMs ?? 0 })}
                </Badge>
              </div>
            ))}
          </Card>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {say(SYSTEM.recordedFor, { ms: slowQueryThresholdMs, days: METRIC_RETENTION_DAYS })}
        </p>
      </section>

      {/* An installed app has no address bar, so a page reachable only by typing its
          path is a page nobody on a phone can open. This is the way in, and it is here
          because this is where the deployment is inspected — and it goes when the
          readout does. */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">{say(SYSTEM.thisDevice)}</h2>
        <Card>
          <p className="text-sm text-slate-500">{say(SYSTEM.thisDeviceHint)}</p>
          <ButtonLink href="/bars" variant="secondary" className="mt-3">
            {say(SYSTEM.bars)}
          </ButtonLink>
        </Card>
      </section>
    </>
  );
}
