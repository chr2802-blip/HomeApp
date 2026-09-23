import type { HomeLanguage } from "@prisma/client";
import { getHomeReminderStatus } from "@/lib/system-stats";
import { readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { Badge, Card } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { REMINDERS } from "@/lib/copy/admin";

/**
 * A home admin's answer to "are reminders actually working for us?", built only from
 * their own home's rows. Nothing here reveals anything about another home or about the
 * installation as a whole.
 */
export async function ReminderStatus({ homeId, language }: { homeId: string; language: HomeLanguage }) {
  const now = new Date();
  const status = await getHomeReminderStatus(homeId, now);
  const say = sayIn(language);

  const nobodySubscribed = status.subscriptions === 0;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={nobodySubscribed ? "amber" : "green"}>
          {nobodySubscribed ? say(REMINDERS.noOneNotified) : say(REMINDERS.notificationsOn)}
        </Badge>
        <p className="text-sm text-slate-600">
          {say(REMINDERS.subscribedCount, {
            count: status.memberCount,
            subscriptions: status.subscriptions,
            members: status.memberCount,
          })}
        </p>
      </div>

      {nobodySubscribed && <p className="text-sm text-slate-600">{say(REMINDERS.nobodySubscribed)}</p>}

      <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
        <p>
          {say(REMINDERS.lastReminderSent)}{" "}
          <span className="font-medium text-slate-900">
            {status.lastNotifiedAt
              ? readInZone(status.lastNotifiedAt, DATE.dayAndTime, language)
              : say(REMINDERS.never)}
          </span>
        </p>
        <p>
          {say(REMINDERS.nextTaskDue)}{" "}
          <span className="font-medium text-slate-900">
            {status.nextDue
              ? readInZone(status.nextDue.nextDueAt, DATE.dayMonth, language)
              : say(REMINDERS.nothingScheduled)}
          </span>
        </p>
      </div>

      {status.overdue > 0 && (
        <p className="text-sm text-amber-700">
          {say(REMINDERS.overdueCount, { count: status.overdue })}
        </p>
      )}
    </Card>
  );
}
