import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import {
  completeTask,
  deleteTask,
  reopenTask,
  snoozeTask,
  updateTask,
} from "@/app/actions/tasks";
import { Card } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { PhotoBanner, PhotoThumb } from "@/components/photo";
import { SnoozeMenuItem } from "@/components/task-snooze";
import { SubmitButton } from "@/components/submit-button";
import { TaskDoneButton } from "@/components/task-done-button";
import { TONE_TEXT, TaskFields } from "@/components/task-row";
import { dueLabel, dueTone } from "@/lib/due";
import { isFinished, isSnoozable, repeatLabel } from "@/lib/tasks";
import { readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { TASKS } from "@/lib/copy/tasks";

/** One line of the facts card: what it is, and its answer. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

/**
 * A task on its own: everything the row on `/tasks` and the dashboard leaves out to stay
 * one line — the notes, the history, the picture at a size worth looking at — and the
 * one press the task is for, as the page's main button.
 */
export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const language = user.homeLanguage;
  const now = new Date();

  const db = homeDb(user.homeId);
  // Scoped to the caller's home, so another home's id finds nothing — indistinguishable
  // from a task that never existed.
  const [task, memberships] = await Promise.all([
    db.task.findUnique({
      where: { id },
      include: { assignee: { select: { id: true, name: true } } },
    }),
    db.homeMember.findMany({
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);
  if (!task) notFound();

  const members = memberships.map((membership) => membership.user);
  const finished = isFinished(task);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!task.photoId && (
            // Decorative: the title is right beside it.
            <PhotoThumb photoId={null} alt="" className="h-11 w-11" placeholder="task" />
          )}
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight break-words">
            {task.title}
          </h1>
        </div>
        <ItemMenu
          name="taskId"
          id={task.id}
          label={task.title}
          editTitle={say(TASKS.editTask)}
          editAction={updateTask}
          deleteAction={deleteTask}
          deleteMessage={say(TASKS.deleteTaskMessage, { title: task.title })}
          extraItems={
            isSnoozable(task, now) && <SnoozeMenuItem taskId={task.id} action={snoozeTask} />
          }
          className="-mr-2"
        >
          <TaskFields task={task} members={members} language={language} />
        </ItemMenu>
      </div>

      {task.photoId && <PhotoBanner photoId={task.photoId} alt="" className="mb-4" />}

      <Card padded={false} className="mb-4">
        <dl className="divide-y divide-slate-100">
          {!finished && (
            <Fact label={say(TASKS.due)}>
              <span className={TONE_TEXT[dueTone(task.nextDueAt, now)]}>
                {dueLabel(task.nextDueAt, language, now)}
              </span>
            </Fact>
          )}
          <Fact label={say(TASKS.repeatsRow)}>{repeatLabel(task, language)}</Fact>
          <Fact label={say(TASKS.assignedRow)}>{task.assignee?.name ?? say(TASKS.everyone)}</Fact>
          <Fact label={say(TASKS.lastDoneRow)}>
            {task.lastCompletedAt
              ? readInZone(task.lastCompletedAt, DATE.dayMonthYear, language)
              : say(TASKS.neverDone)}
          </Fact>
        </dl>
      </Card>

      {task.notes && (
        <Card className="mb-4">
          <h2 className="mb-1 text-xs font-semibold text-slate-500 uppercase">{say(TASKS.notes)}</h2>
          <p className="whitespace-pre-line text-slate-700">{task.notes}</p>
        </Card>
      )}

      <div className="flex justify-center pt-2">
        {finished ? (
          // Reopening is a correction rather than an achievement, so it stays a plain
          // form: the tick rising out of the button would be celebrating an undo.
          <form action={reopenTask}>
            <input type="hidden" name="taskId" value={task.id} />
            <SubmitButton variant="secondary" pendingLabel={say(APP.saving)}>
              {say(TASKS.reopen)}
            </SubmitButton>
          </form>
        ) : (
          <TaskDoneButton
            taskId={task.id}
            action={completeTask}
            label={say(TASKS.markDone)}
            variant="primary"
          />
        )}
      </div>
    </>
  );
}
