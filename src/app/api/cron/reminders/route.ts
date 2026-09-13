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

  let delivered = 0;
  for (const task of dueTasks) {
    const members = await prisma.user.findMany({
      where: { homeId: task.homeId },
      select: { id: true },
    });

    delivered += await sendPushToUsers(
      members.map((member) => member.id),
      { title: "Task due", body: task.title, url: "/tasks" },
    );

    await prisma.recurringTask.update({
      where: { id: task.id },
      data: { lastNotifiedAt: now },
    });
  }

  return NextResponse.json({ tasksDue: dueTasks.length, notificationsSent: delivered });
}
