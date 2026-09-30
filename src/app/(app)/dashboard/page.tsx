import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { openItemCounts } from "@/lib/list-counts";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { completeTask, snoozeTask } from "@/app/actions/tasks";
import { TaskDoneButton } from "@/components/task-done-button";
import { TaskSnoozeMenu } from "@/components/task-snooze";
import { NotificationSetup } from "@/components/notification-setup";
import { dueTone } from "@/lib/due";
import type { HomeLanguage } from "@prisma/client";
import { UNFINISHED, isSnoozable } from "@/lib/tasks";
import { TaskRow, type TaskSummary } from "@/components/task-row";
import { PhotoThumb } from "@/components/photo";
import { faceOf } from "@/lib/emoji";
import { dayLine, greeting } from "@/lib/greeting";
import { DinnerRow } from "@/components/suggested-recipe";
import { ProgressBar } from "@/components/progress-bar";
import { homeStreak, streakLine } from "@/lib/streak";
import { weekWorkload } from "@/lib/week";
import { WeekRing } from "@/components/week-progress";
import { Collapsible } from "@/components/collapsible";
import { tonightsDinner } from "@/lib/recipe-suggestion";
import { readDayInZone, todayInZone, weekDays } from "@/lib/time";
import { sayIn } from "@/lib/copy/say";
import { DASHBOARD } from "@/lib/copy/dashboard";
import { APP } from "@/lib/copy/app";
import { DATE } from "@/lib/copy/dates";
import { MEALS } from "@/lib/copy/meals";

/**
 * How many lists the dashboard draws before it stops and offers the rest.
 *
 * Four is two rows of the two-column tiles, and it is the last block on a page whose
 * first screen is the page — a fifth and a sixth are below the fold either way, where the Lists tab reaches them in one press and this does not. The
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

function itemsLine(total: number, open: number, language: HomeLanguage) {
  const say = sayIn(language);
  if (total === 0) return say(DASHBOARD.nothingOnItYet);
  if (open === 0) return say(DASHBOARD.allDone);
  return say(APP.addToList.open, { count: open });
}

/**
 * One due task, as a row of the "Today" card — the same `TaskRow` as `/tasks`, so
 * pressing it opens the task's own page. The "Done" button is on every row, in both
 * groups: naming somebody decides who is reminded, not who is allowed to do the job.
 *
 * **One row, not a card of two.** Each task used to be a card of its own — the name on
 * one row, a due badge and Done on the next — which on a phone was about a hundred
 * pixels a task, so three of them pushed the dinner and the lists off the first screen.
 *
 * Beside it, on the rows where it means anything, the one other answer this page is ever
 * given: not today (`isSnoozable`). The three dots are a small icon, not a second button
 * the size of Done, so a thumb aiming at "later" does not land on the job being marked
 * done — see `TaskSnoozeMenu`.
 */
function DueTask({
  task,
  now,
  language,
  showWho = false,
}: {
  task: TaskSummary;
  now: Date;
  language: HomeLanguage;
  /** Only in "due for someone else": on your own jobs it would be your own face on
   *  every row, saying nothing the heading did not. */
  showWho?: boolean;
}) {
  const say = sayIn(language);
  return (
    <TaskRow
      task={task}
      now={now}
      language={language}
      showWho={showWho}
      trailing={
        <>
          {isSnoozable(task, now) && (
            <TaskSnoozeMenu taskId={task.id} title={task.title} action={snoozeTask} className="-mx-1" />
          )}
          {/* The same press as the one on the tasks page, drawn by the same component so
              the tick rises out of it in both places. */}
          <TaskDoneButton taskId={task.id} action={completeTask} label={say(DASHBOARD.done)} />
        </>
      }
    />
  );
}

/**
 * One of the three numbers under the greeting, and the page it is a way into.
 *
 * Each answers a question somebody opens the app with — is anything of mine due, what do
 * we need, what have we run out of — before they have read a row, and each is one press
 * from the page that answers it at length. No `font-medium` on the words: the recipe
 * suggestion's test finds tonight's title as the first medium-weight line in `main`.
 */
function StatTile({
  href,
  value,
  label,
  detail,
  warn = false,
}: {
  href: string;
  value: number;
  label: string;
  detail: string;
  warn?: boolean;
}) {
  return (
    <Link href={href} className="pressable block rounded-xl active:scale-[0.98]">
      <Card padded={false} className="h-full px-3 py-2 transition hover:border-slate-400">
        <p className="text-xl leading-tight font-semibold tabular-nums">{value}</p>
        <p className="truncate text-xs text-slate-700">{label}</p>
        <p className={`truncate text-[11px] ${warn ? "text-red-600" : "text-slate-400"}`}>{detail}</p>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const say = sayIn(user.homeLanguage);

  if (!user.homeId) {
    return (
      <>
        <PageHeader title={say(DASHBOARD.noHomeSelected)} description={say(DASHBOARD.pickAHome)} />
        <EmptyState>
          <p>{say(DASHBOARD.notInAHome)}</p>
          <ButtonLink href="/homes" className="mt-4">
            {say(DASHBOARD.goToYourHomes)}
          </ButtonLink>
        </EmptyState>
      </>
    );
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const db = homeDb(user.homeId);
  const today = todayInZone(now);
  // The six days after today — tonight is already the dinner row in "Today".
  const ahead = weekDays(today).slice(1);

  const [dueTasks, favorites, recent, open, week, streak, dinner, plans, runOut] = await Promise.all([
    db.task.findMany({
      // A one-off already done is not due, however long its date has been in the past.
      where: { nextDueAt: { lte: soon }, ...UNFINISHED },
      orderBy: { nextDueAt: "asc" },
      include: { assignee: { select: { name: true, photoId: true } } },
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
    tonightsDinner(user.homeId, user.homeLanguage),
    db.mealPlan.findMany({
      where: { date: { in: ahead } },
      select: { date: true, leftoverOf: true, recipe: { select: { title: true } } },
    }),
    db.pantryItem.count({ where: { quantity: 0 } }),
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

  const overdue = mine.filter((task) => dueTone(task.nextDueAt, now) === "red").length;
  // Everything still to buy across the home, and how many lists it is spread over —
  // `open` already counts every list, not only the four drawn below.
  const openCounts = [...open.values()].filter((count) => count > 0);
  const toBuy = openCounts.reduce((sum, count) => sum + count, 0);
  const planned = new Map(plans.map((plan) => [plan.date, plan]));
  const firstName = user.name.split(" ")[0]!;

  return (
    <>
      {/*
        The home's picture, the date, the greeting and the week, in the space a greeting
        alone used to take. The picture used to open the page as a banner across the
        full width; as a square beside the greeting it still says whose home this is
        and costs no height, which is what lets everything below fit on one screen.
        Only when the household has put one up — a placeholder glyph here would be
        decoration on the one screen that has no room for it.
      */}
      <header className="mb-3 flex items-center gap-4">
        {user.homePhotoId && (
          <PhotoThumb
            photoId={user.homePhotoId}
            alt={user.homeName ?? say(DASHBOARD.thisHome)}
            className="h-16 w-16"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-[var(--accent)] uppercase">
            {readDayInZone(today, DATE.weekdayDayMonth, user.homeLanguage)}
          </p>
          <h1 className="mt-0.5 text-2xl">{greeting(firstName, now, user.homeLanguage)}</h1>
          {/* One line under the greeting, never two — the header shares its height with
              the week's ring, and a second line is height the first screen needs. A
              streak running is the better thing to say, so it wins; otherwise the day
              is said in words. */}
          <p className="mt-1 text-xs text-slate-500">
            {streak.weeks > 0
              ? streakLine(streak, user.homeLanguage)
              : dayLine(
                  {
                    dish: dinner?.suggestable ? dinner.title : null,
                    dueCount: mine.length,
                    seasonal: user.homeSeasonal,
                  },
                  now,
                  user.homeLanguage,
                )}
          </p>
        </div>
        <WeekRing week={week} language={user.homeLanguage} />
      </header>

      <div className="grid grid-cols-3 gap-2">
        <StatTile
          href="/tasks"
          value={mine.length}
          label={say(DASHBOARD.dueForYouTile)}
          detail={
            overdue > 0
              ? say(DASHBOARD.overdueCount, { count: overdue })
              : say(DASHBOARD.noneOverdue)
          }
          warn={overdue > 0}
        />
        <StatTile
          href="/lists"
          value={toBuy}
          label={say(DASHBOARD.toBuy)}
          detail={say(DASHBOARD.onLists, { count: openCounts.length })}
        />
        <StatTile
          href="/pantry"
          value={runOut}
          label={say(DASHBOARD.runOut)}
          detail={say(DASHBOARD.inThePantry)}
        />
      </div>

      <NotificationSetup />

      {/*
        Everything that is today's business in one card: the dinner, then what is due for
        you, then — folded, with its count — what is due for somebody else. A group is
        drawn only when there is something in it; a heading whose body is always
        "nothing due" teaches nobody anything.
      */}
      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-500 uppercase">
          {say(DASHBOARD.today)}
        </h2>
        {!dinner && dueTasks.length === 0 ? (
          <p className="text-sm text-slate-500">{say(DASHBOARD.nothingToday)}</p>
        ) : (
          <Card padded={false} className="divide-y divide-slate-100">
            {dinner && <DinnerRow dinner={dinner} language={user.homeLanguage} />}

            {mine.length > 0 && (
              <section>
                <h3 className="px-3 pt-2.5 text-[11px] font-semibold text-slate-400 uppercase">
                  {say(DASHBOARD.dueForYou)}
                </h3>
                <div className="divide-y divide-slate-100">
                  {mine.map((task) => (
                    <DueTask key={task.id} task={task} now={now} language={user.homeLanguage} />
                  ))}
                </div>
              </section>
            )}

            {/* Information rather than a job, so folded away; the count is on the
                heading, because a heading hiding an unknown quantity is one nobody
                opens. */}
            {theirs.length > 0 && (
              <section>
                <Collapsible
                  summary={say(DASHBOARD.dueForSomeoneElse, { count: theirs.length })}
                  headingClassName="px-3 py-2.5 text-xs font-medium text-slate-500"
                  triggerClassName="hover:text-slate-700"
                  panelClassName="divide-y divide-slate-100 border-t border-slate-100"
                >
                  {theirs.map((task) => (
                    <DueTask key={task.id} task={task} now={now} language={user.homeLanguage} showWho />
                  ))}
                </Collapsible>
              </section>
            )}
          </Card>
        )}
      </section>

      {/*
        The rest of the week's dinners, so "what are we eating on Thursday" and "do we
        need to shop for it" are answered here rather than one tab away. Only when
        anything ahead is planned: a strip of six empty days is a to-do list the
        household never asked for.
      */}
      {plans.length > 0 && (
        <section className="mt-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase">
              {say(DASHBOARD.comingUp)}
            </h2>
            <Link href="/meals" className="text-xs font-medium text-slate-900 underline">
              {say(DASHBOARD.mealPlan)}
            </Link>
          </div>
          {/* Scrolls sideways out to the screen's edges rather than squeezing six days
              into one row, where every title would be two letters wide. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {ahead.map((day) => {
              const plan = planned.get(day);
              const what = plan?.recipe
                ? plan.recipe.title
                : plan?.leftoverOf
                  ? say(MEALS.leftovers)
                  : plan
                    ? say(MEALS.eatingOut)
                    : say(MEALS.nothingPlanned);
              return (
                <Link
                  key={day}
                  href="/meals"
                  className="pressable w-[84px] shrink-0 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-center active:scale-[0.98]"
                >
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">
                    {readDayInZone(day, DATE.weekdayShort, user.homeLanguage)}
                  </p>
                  <p
                    className={`mt-1 line-clamp-2 text-xs leading-tight ${plan ? "text-slate-800" : "text-slate-300"}`}
                  >
                    {what}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-4">
        {/* The heading and the way out of it on one row: the link only appears when
            there is something it would show that this section does not. */}
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase">
            {starred ? say(DASHBOARD.favouriteLists) : say(DASHBOARD.recentLists)}
          </h2>
          {more && (
            <Link href="/lists" className="text-xs font-medium text-slate-900 underline">
              {say(DASHBOARD.seeAll)}
            </Link>
          )}
        </div>
        {lists.length === 0 ? (
          <EmptyState icon="📝">
            {say(DASHBOARD.noListsYet)}{" "}
            <Link href="/lists" className="font-medium text-slate-900 underline">
              {say(DASHBOARD.createOne)}
            </Link>
          </EmptyState>
        ) : (
          // Two to a row at every width: a list tile is a name and a count, and a
          // full-width card with a picture was twice the height for the same two lines.
          <div className="grid grid-cols-2 gap-2">
            {lists.map((list) => {
              const total = list._count.items;
              const stillOpen = open.get(list.id) ?? 0;

              return (
                <Link
                  key={list.id}
                  href={`/lists/${list.id}`}
                  className="pressable block rounded-xl active:scale-[0.98]"
                >
                  <Card
                    padded={false}
                    className="relative overflow-hidden px-3 pt-2.5 pb-3.5 transition hover:border-slate-400"
                  >
                    <p className="truncate text-sm font-medium">
                      {faceOf(list) && (
                        <span aria-hidden="true" className="mr-1.5">
                          {faceOf(list)}
                        </span>
                      )}
                      {list.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {itemsLine(total, stillOpen, user.homeLanguage)}
                    </p>
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
            {say(DASHBOARD.starAListOn)}{" "}
            <Link href="/lists" className="font-medium text-slate-900 underline">
              {say(DASHBOARD.listsPage)}
            </Link>{" "}
            {say(DASHBOARD.toKeepItHereInstead)}
          </p>
        )}
      </section>
    </>
  );
}
