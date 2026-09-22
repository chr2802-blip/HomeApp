import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { endOfDayInZone } from "@/lib/time";
import { UNFINISHED } from "@/lib/tasks";
import { presentsCronSecret } from "@/lib/cron-secret";
import {
  REMINDER_JOB,
  finishCronRun,
  pruneMetrics,
  startCronRun,
} from "@/lib/observability";
import { DEFAULT_LANGUAGE } from "@/lib/language";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

export const dynamic = "force-dynamic";

/** Notifies each home's members once per day about tasks that are due or overdue. */
export async function GET(request: Request) {
  if (!presentsCronSecret(request)) {
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

  const dueTasks = await prisma.task.findMany({
    where: {
      // Anything due by the end of today, not just by the moment this job runs. The
      // schedule fires in the morning while tasks come due at 09:00 local, so comparing
      // against `now` skipped every task on its own due date and notified a day late.
      nextDueAt: { lte: endOfDayInZone(now) },
      OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: notifiedCutoff } }],
      // A one-off that has been done keeps the date it was due, which is now in the
      // past — so without this it would be reminded about every day, for ever.
      ...UNFINISHED,
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
  const [members, homes] = await Promise.all([
    prisma.homeMember.findMany({
      where: { homeId: { in: homeIds } },
      select: { userId: true, homeId: true },
    }),
    // The notification's title is read with no session, so it takes each home's own
    // language from the row rather than from whoever happens to be looking at a
    // screen — a person in two homes hears about each in that home's own voice.
    prisma.home.findMany({ where: { id: { in: homeIds } }, select: { id: true, language: true } }),
  ]);

  const membersByHome = new Map<string, string[]>();
  for (const member of members) {
    const existing = membersByHome.get(member.homeId);
    if (existing) existing.push(member.userId);
    else membersByHome.set(member.homeId, [member.userId]);
  }

  const languageByHome = new Map(homes.map((home) => [home.id, home.language]));

  let delivered = 0;
  for (const task of dueTasks) {
    const say = sayIn(languageByHome.get(task.homeId) ?? DEFAULT_LANGUAGE);
    delivered += await sendPushToUsers(recipientsFor(task, membersByHome.get(task.homeId) ?? []), {
      title: say(APP.push.taskDue),
      body: task.title,
      url: "/tasks",
    });
  }

  // One write for the whole batch instead of one per task.
  await prisma.task.updateMany({
    where: { id: { in: dueTasks.map((task) => task.id) } },
    data: { lastNotifiedAt: now },
  });

  await prune(now);

  return { tasksDue: dueTasks.length, notificationsSent: delivered };
}

/**
 * Who hears about one task: the member it names, or the whole household when it names
 * nobody.
 *
 * The named member is looked up in the home's roster rather than trusted outright. An
 * assignment outlives the membership it was made under — somebody removed from a home
 * keeps the tasks they were handed there, as they keep everything else they touched —
 * and a task whose one recipient has left would otherwise go quiet with nobody noticing.
 * Then it falls back to the household, which is where an unnamed task already sends it.
 */
function recipientsFor(task: { assigneeId: string | null }, members: string[]) {
  if (!task.assigneeId) return members;
  return members.includes(task.assigneeId) ? [task.assigneeId] : members;
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
