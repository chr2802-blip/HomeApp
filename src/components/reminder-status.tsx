import type { HomeLanguage } from "@prisma/client";
import { getHomeReminderStatus } from "@/lib/system-stats";
import { readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { Badge, Card } from "@/components/ui";

/**
 * A home admin's answer to "are reminders actually working for us?", built only from
 * their own home's rows. Nothing here reveals anything about another home or about the
 * installation as a whole.
 */
export async function ReminderStatus({ homeId, language }: { homeId: string; language: HomeLanguage }) {
  const now = new Date();
  const status = await getHomeReminderStatus(homeId, now);

  const nobodySubscribed = status.subscriptions === 0;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={nobodySubscribed ? "amber" : "green"}>
          {nobodySubscribed ? "no one will be notified" : "notifications on"}
        </Badge>
        <p className="text-sm text-slate-600">
          {status.subscriptions} of {status.memberCount}{" "}
          {status.memberCount === 1 ? "person has" : "people have"} turned reminders on.
        </p>
      </div>

      {nobodySubscribed && (
        <p className="text-sm text-slate-600">
          Tasks will still come due, but nobody gets a reminder until someone enables
          notifications from the dashboard.
        </p>
      )}

      <div className="grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
        <p>
          Last reminder sent:{" "}
          <span className="font-medium text-slate-900">
            {status.lastNotifiedAt
              ? readInZone(status.lastNotifiedAt, DATE.dayAndTime, language)
              : "never"}
          </span>
        </p>
        <p>
          Next task due:{" "}
          <span className="font-medium text-slate-900">
            {status.nextDue ? readInZone(status.nextDue.nextDueAt, DATE.dayMonth, language) : "nothing scheduled"}
          </span>
        </p>
      </div>

      {status.overdue > 0 && (
        <p className="text-sm text-amber-700">
          {status.overdue} {status.overdue === 1 ? "task is" : "tasks are"} overdue in this home.
        </p>
      )}
    </Card>
  );
}
