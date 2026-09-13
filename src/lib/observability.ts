import { prisma } from "./prisma";

export const REMINDER_JOB = "reminders";

/**
 * A reminder run is expected daily. Anything past this and the schedule has most
 * likely stopped — the failure nobody would otherwise notice, because no reminders
 * looks identical to nothing being due.
 */
export const REMINDER_STALE_AFTER_HOURS = 26;

/** How long metrics are kept before the reminder job prunes them. */
export const METRIC_RETENTION_DAYS = 7;

export type HealthStatus = "ok" | "degraded" | "down";

export type Health = {
  status: HealthStatus;
  database: { reachable: boolean; latencyMs: number | null };
  reminders: {
    lastRunAt: Date | null;
    ageHours: number | null;
    ok: boolean | null;
    stale: boolean;
    error: string | null;
  };
  version: string | null;
  environment: string;
};

/** Round-trips the database so the check fails when the connection is gone. */
async function pingDatabase() {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { reachable: true, latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { reachable: false, latencyMs: null };
  }
}

export async function getHealth(now: Date = new Date()): Promise<Health> {
  const database = await pingDatabase();

  const lastRun = database.reachable
    ? await prisma.cronRun.findFirst({
        where: { job: REMINDER_JOB, finishedAt: { not: null } },
        orderBy: { startedAt: "desc" },
      })
    : null;

  const lastRunAt = lastRun?.finishedAt ?? null;
  const ageHours = lastRunAt
    ? (now.getTime() - lastRunAt.getTime()) / (60 * 60 * 1000)
    : null;

  // No run at all is not yet a fault: a freshly deployed app has never had one.
  const stale = ageHours !== null && ageHours > REMINDER_STALE_AFTER_HOURS;

  const status: HealthStatus = !database.reachable
    ? "down"
    : stale || lastRun?.ok === false
      ? "degraded"
      : "ok";

  return {
    status,
    database,
    reminders: {
      lastRunAt,
      ageHours: ageHours === null ? null : Math.round(ageHours * 10) / 10,
      ok: lastRun?.ok ?? null,
      stale,
      error: lastRun?.error ?? null,
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  };
}

/** Opens a run row, so a job that dies midway still leaves a trace of having started. */
export async function startCronRun(job: string) {
  return prisma.cronRun.create({ data: { job } });
}

export async function finishCronRun(
  id: string,
  outcome: { ok: boolean; tasksDue?: number; notificationsSent?: number; error?: string },
) {
  await prisma.cronRun.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      ok: outcome.ok,
      tasksDue: outcome.tasksDue ?? 0,
      notificationsSent: outcome.notificationsSent ?? 0,
      // Truncated: a stack trace belongs in the logs, not in a status table.
      error: outcome.error?.slice(0, 500) ?? null,
    },
  });
}

/** Keeps the metric tables from growing without bound. */
export async function pruneMetrics(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - METRIC_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [slowQueries, cronRuns] = await Promise.all([
    prisma.slowQuery.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.cronRun.deleteMany({ where: { startedAt: { lt: cutoff } } }),
  ]);

  return { slowQueries: slowQueries.count, cronRuns: cronRuns.count };
}
