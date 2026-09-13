import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { endOfDayInZone } from "@/lib/time";
import {
  REMINDER_JOB,
  finishCronRun,
  pruneMetrics,
  startCronRun,
} from "@/lib/observability";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Notifies each home's members once per day about tasks that are due or overdue. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Opened before any work, so a run that dies partway still leaves a record of
  // having started rather than looking like it never ran.
  const run = await startCronRun(REMINDER_JOB);

  try {
    const result = await sendDueReminders();
    await finishCronRun(run.id, { ok: true, ...result });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCronRun(run.id, { ok: false, error: message });
    console.error(
      JSON.stringify({ level: "error", event: "cron_failed", job: REMINDER_JOB, message }),
    );
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}

async function sendDueReminders() {
  const now = new Date();
  const notifiedCutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  const dueTasks = await prisma.recurringTask.findMany({
    where: {
      // Anything due by the end of today, not just by the moment this job runs. The
      // schedule fires in the morning while tasks come due at 09:00 local, so comparing
      // against `now` skipped every task on its own due date and notified a day late.
      nextDueAt: { lte: endOfDayInZone(now) },
      OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: notifiedCutoff } }],
    },
  });

  if (dueTasks.length === 0) {
    await prune(now);
    return { tasksDue: 0, notificationsSent: 0 };
  }

  // Members are fetched once for all the homes involved, rather than once per task:
  // a home with several tasks due on the same morning asked for the same rows again
  // and again.
  const homeIds = [...new Set(dueTasks.map((task) => task.homeId))];
  const members = await prisma.user.findMany({
    where: { homeId: { in: homeIds } },
    select: { id: true, homeId: true },
  });

  const membersByHome = new Map<string, string[]>();
  for (const member of members) {
    if (!member.homeId) continue;
    const existing = membersByHome.get(member.homeId);
    if (existing) existing.push(member.id);
    else membersByHome.set(member.homeId, [member.id]);
  }

  let delivered = 0;
  for (const task of dueTasks) {
    delivered += await sendPushToUsers(membersByHome.get(task.homeId) ?? [], {
      title: "Task due",
      body: task.title,
      url: "/tasks",
    });
  }

  // One write for the whole batch instead of one per task.
  await prisma.recurringTask.updateMany({
    where: { id: { in: dueTasks.map((task) => task.id) } },
    data: { lastNotifiedAt: now },
  });

  await prune(now);

  return { tasksDue: dueTasks.length, notificationsSent: delivered };
}

/**
 * The daily run is also when old metrics are cleared out, which avoids a second
 * schedule existing purely to take out the rubbish. Failing to tidy up is not a
 * failure to send reminders, so it is reported without failing the run.
 */
async function prune(now: Date) {
  try {
    await pruneMetrics(now);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "metric_prune_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
