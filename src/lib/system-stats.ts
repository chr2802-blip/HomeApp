import { prisma, slowQueryThresholdMs } from "./prisma";
import { REMINDER_JOB } from "./observability";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Everything the system page shows, gathered in as few round trips as possible. */
export async function getSystemStats(now: Date = new Date()) {
  const since = new Date(now.getTime() - DAY_MS);

  const [homes, users, lists, tasks, recipes, subscriptions, recentRuns, slowQueries, overdue] =
    await Promise.all([
      prisma.home.count(),
      prisma.user.count(),
      prisma.list.count(),
      prisma.recurringTask.count(),
      prisma.recipe.count(),
      prisma.pushSubscription.count(),
      prisma.cronRun.findMany({
        where: { job: REMINDER_JOB },
        orderBy: { startedAt: "desc" },
        take: 7,
      }),
      prisma.slowQuery.groupBy({
        by: ["model", "operation"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _max: { durationMs: true },
        orderBy: { _max: { durationMs: "desc" } },
        take: 10,
      }),
      prisma.recurringTask.count({ where: { nextDueAt: { lt: now } } }),
    ]);

  return {
    totals: { homes, users, lists, tasks, recipes, subscriptions, overdue },
    recentRuns,
    slowQueries,
    slowQueryThresholdMs: slowQueryThresholdMs(),
  };
}

/**
 * What a home admin is entitled to see: whether reminders are reaching their own
 * household, with nothing about other homes or the system as a whole.
 */
export async function getHomeReminderStatus(homeId: string, now: Date = new Date()) {
  const [memberCount, subscriptions, lastNotified, overdue, nextDue] = await Promise.all([
    prisma.user.count({ where: { homeId } }),
    prisma.pushSubscription.count({ where: { user: { homeId } } }),
    prisma.recurringTask.findFirst({
      where: { homeId, lastNotifiedAt: { not: null } },
      orderBy: { lastNotifiedAt: "desc" },
      select: { lastNotifiedAt: true },
    }),
    prisma.recurringTask.count({ where: { homeId, nextDueAt: { lt: now } } }),
    prisma.recurringTask.findFirst({
      where: { homeId },
      orderBy: { nextDueAt: "asc" },
      select: { nextDueAt: true, title: true },
    }),
  ]);

  return {
    memberCount,
    subscriptions,
    lastNotifiedAt: lastNotified?.lastNotifiedAt ?? null,
    overdue,
    nextDue,
  };
}
