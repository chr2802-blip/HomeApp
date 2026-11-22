import { homeDb } from "@/lib/home-db";
import { Card, EmptyState } from "@/components/ui";
import { PersonMark } from "@/components/person-mark";
import { CREDIT_DAYS, RECENT_COMPLETIONS, creditSince, tallyCompletions } from "@/lib/task-credit";
import { readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { settingsHome } from "@/lib/settings-home";
import { sayIn } from "@/lib/copy/say";
import { TASK_CREDIT } from "@/lib/copy/settings";

/**
 * Who has been doing the household's jobs: every member's count of "Mark done" over the
 * last month, as bars, and the latest presses under it. It lives in Settings, for the
 * home's admins, rather than on the dashboard or the week: a score with names on it in
 * front of everybody turns the washing-up into a thing worth being seen to do.
 */
export default async function SettingsDonePage() {
  const { user, home } = await settingsHome();
  if (!home) return null;
  const say = sayIn(user.homeLanguage);
  const db = homeDb(home.id);
  const now = new Date();

  const [members, counted, recent] = await Promise.all([
    db.homeMember.findMany({
      select: { user: { select: { id: true, name: true, photoId: true } } },
    }),
    db.taskCompletion.findMany({
      where: { completedAt: { gte: creditSince(now) } },
      select: { userId: true },
    }),
    db.taskCompletion.findMany({
      orderBy: { completedAt: "desc" },
      take: RECENT_COMPLETIONS,
      select: {
        id: true,
        title: true,
        completedAt: true,
        user: { select: { name: true, photoId: true } },
      },
    }),
  ]);

  if (recent.length === 0) return <EmptyState icon="✅">{say(TASK_CREDIT.nobodyYet)}</EmptyState>;

  const tally = tallyCompletions(
    counted,
    members.map((m) => m.user),
  );
  const most = Math.max(1, ...tally.map((row) => row.done));

  return (
    <>
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(TASK_CREDIT.tallyHeading, { days: CREDIT_DAYS })}
        </h2>
        <Card className="space-y-3">
          <p className="text-sm text-slate-500">{say(TASK_CREDIT.tallyTotal, { count: counted.length })}</p>
          <ul className="space-y-3">
            {tally.map((row) => {
              const name = row.name ?? say(TASK_CREDIT.formerMember);
              return (
                <li key={row.userId ?? "former"} className="flex items-center gap-3 text-sm">
                  <PersonMark name={name} photoId={row.photoId} className="h-7 w-7" />
                  <span className="w-24 shrink-0 truncate font-medium">{name}</span>
                  {/* The number beside it says the same, in words; the bar is for the eye. */}
                  <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${(row.done / most) * 100}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-slate-500">
                    {say(TASK_CREDIT.doneCount, { count: row.done })}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">{say(TASK_CREDIT.recentHeading)}</h2>
        <Card padded={false} className="divide-y divide-slate-100">
          {recent.map((done) => (
            <div key={done.id} className="flex items-center gap-3 px-4 py-3">
              {/* Decoration: the name is written beside it. */}
              <PersonMark
                name={done.user?.name ?? say(TASK_CREDIT.formerMember)}
                photoId={done.user?.photoId ?? null}
                className="h-8 w-8"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{done.title}</p>
                <p className="text-xs text-slate-500">
                  {done.user?.name ?? say(TASK_CREDIT.formerMember)} ·{" "}
                  {readInZone(done.completedAt, DATE.dayAndTime, user.homeLanguage)}
                </p>
              </div>
            </div>
          ))}
        </Card>
      </section>
    </>
  );
}
