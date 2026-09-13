import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { endOfDayInZone } from "@/lib/time";

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
    return NextResponse.json({ tasksDue: 0, notificationsSent: 0 });
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

  return NextResponse.json({ tasksDue: dueTasks.length, notificationsSent: delivered });
}
