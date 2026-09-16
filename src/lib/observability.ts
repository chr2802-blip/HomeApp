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

/**
 * Which commit is actually serving this page.
 *
 * A seven-character hash answers "is this the build I pushed" and nothing else. When
 * something looks wrong the next question is always what that commit *was*, and
 * answering it meant leaving the page to go and look the hash up. So the subject line
 * and the branch come with it, and the hash links to the commit itself.
 *
 * Every field is null off Vercel — a laptop has no deployment — which is why the page
 * draws this block only when there is a commit to name.
 */
export type Deployment = {
  /** Short hash, as a person recognises a commit. */
  version: string | null;
  /** First line of the commit message: what shipped, in the words it was written in. */
  message: string | null;
  /** The branch it was built from. Only `main` deploys, so anything else is a surprise. */
  ref: string | null;
  /** The commit on GitHub, or null when the repository is not known. */
  url: string | null;
};

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
  deployment: Deployment;
  environment: string;
};

/**
 * What the platform says about the commit it built.
 *
 * Vercel sets these for the build and for the running function alike; anywhere else
 * they are simply absent, and every field falls to null rather than to a placeholder
 * that would read like a real answer.
 */
export function deploymentInfo(
  // Read as the loose bag of strings it is, rather than as NodeJS.ProcessEnv: this
  // touches five keys and never NODE_ENV, and insisting on the fuller type only forces
  // a cast on every caller that has not got one.
  env: Record<string, string | undefined> = process.env,
): Deployment {
  const sha = env.VERCEL_GIT_COMMIT_SHA ?? null;
  const owner = env.VERCEL_GIT_REPO_OWNER;
  const slug = env.VERCEL_GIT_REPO_SLUG;

  return {
    version: sha?.slice(0, 7) ?? null,
    // The subject line only. A commit body runs to paragraphs here and the card is one
    // line telling somebody what is live, not a place to read a commit in full.
    message: env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0]?.trim() || null,
    ref: env.VERCEL_GIT_COMMIT_REF ?? null,
    url: sha && owner && slug ? `https://github.com/${owner}/${slug}/commit/${sha}` : null,
  };
}

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

  const deployment = deploymentInfo();

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
    // Kept beside `deployment` rather than replaced by it: `/api/health` is read by
    // things outside this repository, and moving a field they already parse is a
    // breaking change for the sake of tidiness.
    version: deployment.version,
    deployment,
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
