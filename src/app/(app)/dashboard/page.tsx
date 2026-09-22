import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { openItemCounts } from "@/lib/list-counts";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { completeTask, snoozeTask } from "@/app/actions/tasks";
import { TaskDoneButton } from "@/components/task-done-button";
import { TaskSnoozeMenu } from "@/components/task-snooze";
import { NotificationSetup } from "@/components/notification-setup";
import { dueLabel, dueTone } from "@/lib/due";
import type { HomeLanguage } from "@prisma/client";
import { UNFINISHED, isSnoozable, repeatLabel } from "@/lib/tasks";
import { PhotoBanner, PhotoThumb } from "@/components/photo";
import { SuggestedRecipe } from "@/components/suggested-recipe";
import { ProgressBar } from "@/components/progress-bar";
import { homeStreak } from "@/lib/streak";
import { weekWorkload } from "@/lib/week";
import { WeekProgress } from "@/components/week-progress";
import { Collapsible } from "@/components/collapsible";

/**
 * How many lists the dashboard draws before it stops and offers the rest.
 *
 * Four is two rows of cards on a desktop and four on a phone, and it is the last block
 * on a page whose first screen is the page — a fifth and a sixth are below the fold
 * either way, where the Lists tab reaches them in one press and this does not. The
 * favourites a household actually keeps are few enough that this rarely bites; what it
 * stops is the home with a dozen lists pushing everything else off the screen.
 */
const DASHBOARD_LISTS = 4;

/**
 * What a list card says about a list: how much of it is still to do.
 *
 * Only the open items are counted. A shopping list keeps everything ticked off as next
 * week's vocabulary, so the total climbs for ever and says the same thing about a list
 * that is finished as about one nobody has started. The total is still fetched, but
 * only to tell an empty list from a finished one — "All done" on a list that has never
 * had anything on it would be a lie told cheerfully.
 *
 * The open half is not here: it is counted for the whole home in one query by
 * `openItemCounts`, because a relation can only be counted one way per query and this
 * one is already carrying the total.
 */
const LIST_COUNTS = { _count: { select: { items: true } } } as const;

function itemsLine(total: number, open: number) {
  if (total === 0) return "Nothing on it yet";
  if (open === 0) return "All done";
  return `${open} open`;
}

type DueTaskRow = {
  id: string;
  title: string;
  intervalDays: number | null;
  nextDueAt: Date;
  /** Only so `isSnoozable` can be asked; everything on this page is unfinished. */
  lastCompletedAt: Date | null;
  photoId: string | null;
  assignee: { name: string } | null;
};

/**
 * One due task, in whichever section it landed in. The "Done" button is on both: naming
 * somebody decides who is reminded, not who is allowed to do the job.
 *
 * Beside it, on the rows where it means anything, the one other answer this page is ever
 * given: not today. This is the screen a household reads in the morning and so the place
 * a task is most often put off, but it reaches three days ahead — and "snooze to
 * tomorrow" about something due on Friday would be bringing it forward, so `isSnoozable`
 * decides.
 *
 * **The name gets a row to itself, and what to do about it gets the next one.** All five
 * pieces used to share one line, wrapping when they ran out of room — which on a phone
 * they always did: the badge and the button are as wide as their own words whatever the
 * screen, so every pixel they took came out of the one column that could give any, and
 * "Tørre køleskab af" came out broken across three lines with a word split down the
 * middle. A task nobody can read is a task nobody does. The second row costs about the
 * height those wrapped lines cost anyway, and spends it on the answer rather than on the
 * question: the date is read from the left, the press is made from the right, and the
 * menu sits out of the thumb's way in the corner above.
 */
function DueTask({
  task,
  now,
  language,
}: {
  task: DueTaskRow;
  now: Date;
  language: HomeLanguage;
}) {
  return (
    <Card className="py-3">
      <div className="flex items-start gap-3">
        {/* Decorative: the task's own name is right beside it. */}
        <PhotoThumb photoId={task.photoId} alt="" className="h-11 w-11" placeholder="task" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{task.title}</p>
          <p className="text-xs text-slate-500">
            {repeatLabel(task)}
            {task.assignee && ` · ${task.assignee.name}`}
          </p>
        </div>
        {/* In the corner rather than beside Done, which is the same distance a thumb
            aiming at "later" has to miss by — see `TaskSnoozeMenu`. */}
        {isSnoozable(task, now) && (
          <TaskSnoozeMenu
            taskId={task.id}
            title={task.title}
            action={snoozeTask}
            className="-mt-1 -mr-2"
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <Badge tone={dueTone(task.nextDueAt, now)}>{dueLabel(task.nextDueAt, language, now)}</Badge>
        {/* The same press as the one on the tasks page, drawn by the same component so
            the tick rises out of it in both places. */}
        <TaskDoneButton taskId={task.id} action={completeTask} label="Done" />
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  if (!user.homeId) {
    return (
      <>
        <PageHeader title="No home selected" description="Pick a home to work in." />
        <EmptyState>
          <p>You are not in a home at the moment.</p>
          <ButtonLink href="/homes" className="mt-4">
            Go to your homes
          </ButtonLink>
        </EmptyState>
      </>
    );
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const db = homeDb(user.homeId);

  const [dueTasks, favorites, recent, open, week, streak] = await Promise.all([
    db.task.findMany({
      // A one-off already done is not due, however long its date has been in the past.
      where: { nextDueAt: { lte: soon }, ...UNFINISHED },
      orderBy: { nextDueAt: "asc" },
      include: { assignee: { select: { name: true } } },
    }),
    // The caller's own stars. Favourites are personal, so two people in one home see
    // different lists here.
    db.list.findMany({
      where: { favorites: { some: { userId: user.id } } },
      orderBy: { title: "asc" },
      include: LIST_COUNTS,
    }),
    db.list.findMany({
      orderBy: { createdAt: "desc" },
      // One more than the dashboard draws, which is how it knows to offer the rest
      // without counting every list in the home to find out.
      take: DASHBOARD_LISTS + 1,
      include: LIST_COUNTS,
    }),
    // How much is left on each of them. Counted for every list in the home rather than
    // for the four drawn, because which four those are is decided below — after the
    // favourites have been compared against the recent ones.
    openItemCounts(user.homeId),
    // Both sides of the week's work, and which side a task falls on — see lib/week.
    weekWorkload(user.homeId, now),
    homeStreak(user.homeId),
  ]);

  /*
   * An unassigned task belongs to the whole household, so it is one of yours too — the
   * split is "is this mine to do" and not "does this have a name on it". Both sides come
   * out of the one query above and are separated here: a household's tasks due in the
   * next few days are few enough that a second round trip would buy nothing.
   */
  const mine = dueTasks.filter((task) => !task.assigneeId || task.assigneeId === user.id);
  const theirs = dueTasks.filter((task) => task.assigneeId && task.assigneeId !== user.id);

  // Favourites replace the recent lists once there are any. Before that the recent ones
  // stay, with a line saying how to change it: a dashboard that shows nothing until you
  // have learnt about a feature teaches nobody anything.
  const starred = favorites.length > 0;
  const all = starred ? favorites : recent;
  const lists = all.slice(0, DASHBOARD_LISTS);
  const more = all.length > lists.length;

  return (
    <>
      {/* The household's own picture, if it has put one up. Above the greeting rather
          than behind it: a photograph with text over it is a photograph you cannot
          quite see and text you cannot quite read. Edge to edge and against the top
          bar, so the page opens on the picture rather than on a framed copy of it. */}
      <PhotoBanner
        photoId={user.homePhotoId}
        alt={user.homeName ?? "This home"}
        bleed
        short
        className="mb-4"
      />

      <PageHeader
        title={`Hi ${user.name.split(" ")[0]}`}
        description={user.homeName ? `${user.homeName} · what needs attention` : undefined}
      />

      {/* The household's own rhythm rather than a scoreboard, and still nobody's name
          on it. It draws nothing at all on a home with no jobs and no history, where
          every number would be a zero. */}
      <WeekProgress week={week} streak={streak} />

      <NotificationSetup />

      {/*
        Only when there is something due for you. A heading whose body is always
        "nothing due" teaches nobody anything and costs everybody the scroll past it.

        First of the three blocks below the week, because it is the only one that is
        somebody's to do something about today. The dinner and the lists are both worth
        having on the first screen and neither is overdue.
      */}
      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Due for you</h2>
          <div className="space-y-2">
            {mine.map((task) => (
              <DueTask key={task.id} task={task} now={now} language={user.homeLanguage} />
            ))}
          </div>
        </section>
      )}

      {/*
        Only when somebody else has something due, and folded away when there is —
        it is information rather than a job, and a full card for each of somebody
        else's tasks is the clearest case on the page of something worth knowing and
        not worth the screen. The count is on the heading, because a heading hiding an
        unknown quantity is one nobody opens; the "Done" button inside is still there
        for whoever gets to it first.
      */}
      {theirs.length > 0 && (
        <section className="mt-6">
          <Collapsible
            summary={`Due for someone else (${theirs.length})`}
            headingClassName="mb-3 text-sm font-semibold text-slate-500 uppercase"
            triggerClassName="hover:text-slate-700"
            panelClassName="space-y-2"
          >
            {theirs.map((task) => (
              <DueTask key={task.id} task={task} now={now} language={user.homeLanguage} />
            ))}
          </Collapsible>
        </section>
      )}

      {/* Below what is due, above the lists: a suggestion is a decision to make this
          evening, not a job that is late. */}
      <SuggestedRecipe homeId={user.homeId} />

      <section className="mt-6">
        {/* The heading and the way out of it on one row: the link only appears when
            there is something it would show that this section does not. */}
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase">
            {starred ? "Favourite lists" : "Recent lists"}
          </h2>
          {/* The same plain link the rest of this page uses for "Create one" and
              "lists page": the home's colour dresses controls, and this is a
              sentence's worth of text beside a heading. */}
          {more && (
            <Link href="/lists" className="text-xs font-medium text-slate-900 underline">
              See all
            </Link>
          )}
        </div>
        {lists.length === 0 ? (
          <EmptyState icon="📝">
            No lists yet.{" "}
            <Link href="/lists" className="font-medium text-slate-900 underline">
              Create one
            </Link>
          </EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {lists.map((list) => {
              const total = list._count.items;
              const stillOpen = open.get(list.id) ?? 0;

              return (
                <Link
                  key={list.id}
                  href={`/lists/${list.id}`}
                  className="pressable block rounded-xl active:scale-[0.98]"
                >
                  <Card className="relative flex items-center gap-3 overflow-hidden transition hover:border-slate-400">
                    {/* Decorative: the list's own name is right beside it. */}
                    <PhotoThumb photoId={list.photoId} alt="" className="h-11 w-11" placeholder="list" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{list.title}</p>
                      <p className="text-xs text-slate-500">{itemsLine(total, stillOpen)}</p>
                    </div>
                    {/* The same edge the lists page draws, and only where there is
                        something to be a proportion of — a list with nothing on it is
                        not done. */}
                    {total > 0 && <ProgressBar edge done={total - stillOpen} total={total} />}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
        {!starred && lists.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Star a list on the{" "}
            <Link href="/lists" className="font-medium text-slate-900 underline">
              lists page
            </Link>{" "}
            to keep it here instead.
          </p>
        )}
      </section>
    </>
  );
}
