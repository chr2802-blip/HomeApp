import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { completeTask } from "@/app/actions/tasks";
import { SubmitButton } from "@/components/submit-button";
import { NotificationSetup } from "@/components/notification-setup";
import { dueLabel, dueTone } from "@/lib/due";
import { UNFINISHED, repeatLabel } from "@/lib/tasks";
import { PhotoBanner, PhotoThumb } from "@/components/photo";

/**
 * What a list card says about a list: how much of it is still to do.
 *
 * Only the open items are counted. A shopping list keeps everything ticked off as next
 * week's vocabulary, so the total climbs for ever and says the same thing about a list
 * that is finished as about one nobody has started. The total is still fetched, but
 * only to tell an empty list from a finished one — "All done" on a list that has never
 * had anything on it would be a lie told cheerfully.
 */
const LIST_COUNTS = {
  _count: { select: { items: true } },
  items: { where: { done: false }, select: { id: true } },
} as const;

function itemsLine(list: { _count: { items: number }; items: unknown[] }) {
  if (list._count.items === 0) return "Nothing on it yet";
  if (list.items.length === 0) return "All done";
  return `${list.items.length} open`;
}

type DueTaskRow = {
  id: string;
  title: string;
  intervalDays: number | null;
  nextDueAt: Date;
  photoId: string | null;
  assignee: { name: string } | null;
};

/**
 * One due task, in whichever section it landed in. The "Done" button is on both: naming
 * somebody decides who is reminded, not who is allowed to do the job.
 */
function DueTask({ task, now }: { task: DueTaskRow; now: Date }) {
  return (
    <Card className="flex flex-wrap items-center gap-3 py-3">
      {/* Decorative: the task's own name is right beside it. */}
      <PhotoThumb photoId={task.photoId} alt="" className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{task.title}</p>
        <p className="text-xs text-slate-500">
          {repeatLabel(task)}
          {task.assignee && ` · ${task.assignee.name}`}
        </p>
      </div>
      <Badge tone={dueTone(task.nextDueAt, now)}>{dueLabel(task.nextDueAt, now)}</Badge>
      <form action={completeTask}>
        <input type="hidden" name="taskId" value={task.id} />
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Done
        </SubmitButton>
      </form>
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

  const [dueTasks, favorites, recent] = await Promise.all([
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
      take: 5,
      include: LIST_COUNTS,
    }),
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
  const lists = starred ? favorites : recent;

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
        className="mb-5"
      />

      <PageHeader
        title={`Hi ${user.name.split(" ")[0]}`}
        description={user.homeName ? `${user.homeName} · what needs attention` : undefined}
      />

      <NotificationSetup />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Due for you</h2>
        {mine.length === 0 ? (
          <EmptyState>Nothing due for you in the next few days.</EmptyState>
        ) : (
          <div className="space-y-2">
            {mine.map((task) => (
              <DueTask key={task.id} task={task} now={now} />
            ))}
          </div>
        )}
      </section>

      {/*
        Only when somebody else has something due. A household where nobody assigns
        anything would otherwise carry a permanently empty heading.
      */}
      {theirs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
            Due for someone else
          </h2>
          <div className="space-y-2">
            {theirs.map((task) => (
              <DueTask key={task.id} task={task} now={now} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {starred ? "Favourite lists" : "Recent lists"}
        </h2>
        {lists.length === 0 ? (
          <EmptyState>
            No lists yet.{" "}
            <Link href="/lists" className="font-medium text-slate-900 underline">
              Create one
            </Link>
          </EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {lists.map((list) => (
              <Link key={list.id} href={`/lists/${list.id}`}>
                <Card className="flex items-center gap-3 transition hover:border-slate-400">
                  {/* Decorative: the list's own name is right beside it. */}
                  <PhotoThumb photoId={list.photoId} alt="" className="h-11 w-11" />
                  <div className="min-w-0">
                    <p className="font-medium">{list.title}</p>
                    <p className="text-xs text-slate-500">{itemsLine(list)}</p>
                  </div>
                </Card>
              </Link>
            ))}
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
