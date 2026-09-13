import { beforeEach, describe, expect, it, vi } from "vitest";

const sendPushToUsers = vi.hoisted(() => vi.fn(async () => 0));
vi.mock("@/lib/push", () => ({ sendPushToUsers }));

const { prisma } = await import("@/lib/prisma");
const { GET: healthRoute } = await import("@/app/api/health/route");
const { GET: cronRoute } = await import("@/app/api/cron/reminders/route");
const {
  REMINDER_JOB,
  REMINDER_STALE_AFTER_HOURS,
  METRIC_RETENTION_DAYS,
  getHealth,
  pruneMetrics,
} = await import("@/lib/observability");
const { createHomeWithMembers, createTask } = await import("../helpers/factories");

const CRON_SECRET = process.env.CRON_SECRET!;

const request = (path: string, token?: string) =>
  new Request(`http://localhost${path}`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

async function recordRun(options: {
  finishedAt?: Date | null;
  ok?: boolean;
  error?: string | null;
  startedAt?: Date;
}) {
  return prisma.cronRun.create({
    data: {
      job: REMINDER_JOB,
      startedAt: options.startedAt ?? options.finishedAt ?? new Date(),
      finishedAt: options.finishedAt === undefined ? new Date() : options.finishedAt,
      ok: options.ok ?? true,
      error: options.error ?? null,
    },
  });
}

beforeEach(() => {
  sendPushToUsers.mockClear();
  sendPushToUsers.mockResolvedValue(0);
});

describe("the health endpoint", () => {
  it("tells an anonymous monitor only the verdict", async () => {
    const response = await healthRoute(request("/api/health"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["at", "status"]);
    expect(body.status).toBe("ok");
  });

  it("never caches, so a monitor sees the current state", async () => {
    const response = await healthRoute(request("/api/health"));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns the detail when the cron secret is presented", async () => {
    await recordRun({ ok: true });

    const response = await healthRoute(request("/api/health", CRON_SECRET));
    const body = await response.json();

    expect(body.database.reachable).toBe(true);
    expect(body.reminders.ok).toBe(true);
    expect(body.reminders.stale).toBe(false);
  });

  it("keeps the detail from a wrong secret", async () => {
    const body = await (await healthRoute(request("/api/health", "wrong"))).json();
    expect(body.database).toBeUndefined();
  });

  it("reports degraded, but still 200, when reminders have stopped", async () => {
    await recordRun({ finishedAt: hoursAgo(REMINDER_STALE_AFTER_HOURS + 2) });

    const response = await healthRoute(request("/api/health", CRON_SECRET));
    const body = await response.json();

    // Still reachable, so a monitor should not page anyone — but it is not healthy.
    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.reminders.stale).toBe(true);
  });

  it("reports degraded when the last run failed", async () => {
    await recordRun({ ok: false, error: "boom" });

    const body = await (await healthRoute(request("/api/health", CRON_SECRET))).json();

    expect(body.status).toBe("degraded");
    expect(body.reminders.error).toBe("boom");
  });

  it("treats a never-run job as healthy, not broken", async () => {
    const health = await getHealth();

    expect(health.reminders.lastRunAt).toBeNull();
    expect(health.reminders.stale).toBe(false);
    expect(health.status).toBe("ok");
  });

  it("ignores a run that never finished when judging freshness", async () => {
    await recordRun({ finishedAt: null });

    const health = await getHealth();

    expect(health.reminders.lastRunAt).toBeNull();
  });
});

describe("the reminder job's heartbeat", () => {
  it("records a successful run with its counts", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: hoursAgo(48) });
    sendPushToUsers.mockResolvedValue(2);

    await cronRoute(request("/api/cron/reminders", CRON_SECRET));

    const run = await prisma.cronRun.findFirstOrThrow();
    expect(run).toMatchObject({
      job: REMINDER_JOB,
      ok: true,
      tasksDue: 1,
      notificationsSent: 2,
      error: null,
    });
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it("records a run even when nothing was due", async () => {
    await cronRoute(request("/api/cron/reminders", CRON_SECRET));

    expect(await prisma.cronRun.findFirstOrThrow()).toMatchObject({ ok: true, tasksDue: 0 });
  });

  it("records the failure and answers 500 when the run throws", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: hoursAgo(48) });
    sendPushToUsers.mockRejectedValue(new Error("push gateway unreachable"));

    const response = await cronRoute(request("/api/cron/reminders", CRON_SECRET));

    expect(response.status).toBe(500);
    const run = await prisma.cronRun.findFirstOrThrow();
    expect(run).toMatchObject({ ok: false, error: "push gateway unreachable" });
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it("leaves no heartbeat for an unauthorised request", async () => {
    await cronRoute(request("/api/cron/reminders", "wrong"));

    expect(await prisma.cronRun.count()).toBe(0);
  });

  it("makes a stalled schedule visible through health", async () => {
    await recordRun({ finishedAt: hoursAgo(48) });

    const health = await getHealth();

    expect(health.status).toBe("degraded");
    expect(health.reminders.ageHours).toBeGreaterThan(REMINDER_STALE_AFTER_HOURS);
  });
});

describe("slow query logging", () => {
  // Lowered only here. Everywhere else the threshold is parked out of reach, so an
  // ordinary slow test query cannot leave rows behind and upset another test.
  const THRESHOLD_MS = 300;
  const parked = process.env.SLOW_QUERY_MS;

  beforeEach(() => {
    process.env.SLOW_QUERY_MS = String(THRESHOLD_MS);
    return () => {
      process.env.SLOW_QUERY_MS = parked;
    };
  });

  /** pg_sleep returns void, which Prisma cannot deserialize — hence the cast. */
  const sleep = (ms: number) =>
    prisma.$queryRawUnsafe(`SELECT pg_sleep(${ms / 1000})::text AS slept`);

  it("records a call that crosses the threshold", async () => {
    await sleep(THRESHOLD_MS + 250);

    // The write is deliberately not awaited by the extension, so give it a moment.
    await expect
      .poll(async () => prisma.slowQuery.count(), { timeout: 5000 })
      .toBeGreaterThan(0);

    const recorded = await prisma.slowQuery.findFirstOrThrow();
    expect(recorded.durationMs).toBeGreaterThanOrEqual(THRESHOLD_MS);
  });

  it("leaves a quick call unrecorded", async () => {
    await prisma.home.count();

    // Nothing to wait for, but give the fire-and-forget write the same chance.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(await prisma.slowQuery.count()).toBe(0);
  });

  it("does not log its own writes, which would never terminate", async () => {
    await sleep(THRESHOLD_MS + 250);
    await expect.poll(async () => prisma.slowQuery.count(), { timeout: 5000 }).toBeGreaterThan(0);

    const settled = await prisma.slowQuery.count();
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(await prisma.slowQuery.count()).toBe(settled);
  });
});

describe("pruning", () => {
  it("clears metrics past the retention window and keeps the rest", async () => {
    const old = new Date(Date.now() - (METRIC_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);

    await recordRun({ startedAt: old, finishedAt: old });
    await recordRun({ ok: true });
    await prisma.slowQuery.createMany({
      data: [
        { operation: "findMany", model: "List", durationMs: 900, createdAt: old },
        { operation: "findMany", model: "List", durationMs: 900 },
      ],
    });

    const removed = await pruneMetrics();

    expect(removed).toEqual({ slowQueries: 1, cronRuns: 1 });
    expect(await prisma.cronRun.count()).toBe(1);
    expect(await prisma.slowQuery.count()).toBe(1);
  });

  it("runs as part of the reminder job", async () => {
    const old = new Date(Date.now() - (METRIC_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000);
    await prisma.slowQuery.create({
      data: { operation: "findMany", model: "List", durationMs: 900, createdAt: old },
    });

    await cronRoute(request("/api/cron/reminders", CRON_SECRET));

    expect(await prisma.slowQuery.count()).toBe(0);
  });
});
