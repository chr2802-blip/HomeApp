import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import {
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  snoozeTask,
  updateTask,
} from "@/app/actions/tasks";
import { Card, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { FINISHED, UNFINISHED, isFinished, isSnoozable } from "@/lib/tasks";
import { todayInZone } from "@/lib/time";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { TASKS } from "@/lib/copy/tasks";
import type { HomeLanguage } from "@prisma/client";
import { FormDialog } from "@/components/form-dialog";
import { AssigneeField, type MemberOption } from "@/components/assignee-field";
import { RepeatField } from "@/components/repeat-field";
import { ItemMenu } from "@/components/item-menu";
import { SnoozeMenuItem } from "@/components/task-snooze";
import { SubmitButton } from "@/components/submit-button";
import { TaskDoneButton } from "@/components/task-done-button";
import { TaskFields, TaskRow, type TaskSummary } from "@/components/task-row";
import { EmojiField } from "@/components/emoji-field";
import { Collapsible } from "@/components/collapsible";
import { PhotoField } from "@/components/photo-field";

type TaskItemRow = TaskSummary & { notes: string | null; assigneeId: string | null };

/**
 * One task as a row of the page's card. Pressing it opens the task's own page; the
 * three dots carry snooze, edit and delete, as they do on every other stored thing; and
 * the button at the end is the press this page is mostly for.
 *
 * A finished one-off shows the way back instead of Done. It is the same button in the
 * same place because it is the same thought a moment later — pressing Done on the wrong
 * row is the mistake this undoes, and hiding the undo behind the menu would make finding
 * it the hard part.
 */
function TaskItem({
  task,
  members,
  now,
  language,
}: {
  task: TaskItemRow;
  members: MemberOption[];
  now: Date;
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <TaskRow
      task={task}
      now={now}
      language={language}
      showWho
      trailing={
        <>
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
            className="-mx-1"
          >
            <TaskFields task={task} members={members} language={language} />
          </ItemMenu>
          {isFinished(task) ? (
            // Reopening is a correction rather than an achievement, so it stays a plain
            // form: the tick rising out of the button would be celebrating an undo.
            <form action={reopenTask}>
              <input type="hidden" name="taskId" value={task.id} />
              <SubmitButton variant="secondary" pendingLabel={say(APP.saving)}>
                {say(TASKS.reopen)}
              </SubmitButton>
            </form>
          ) : (
            <TaskDoneButton taskId={task.id} action={completeTask} label={say(TASKS.doneButton)} />
          )}
        </>
      }
    />
  );
}

function TaskList({
  tasks,
  members,
  now,
  language,
}: {
  tasks: TaskItemRow[];
  members: MemberOption[];
  now: Date;
  language: HomeLanguage;
}) {
  return (
    <Card padded={false} className="divide-y divide-slate-100">
      {tasks.map((task, index) => (
        <div
          key={task.id}
          className="animate-row-in"
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
          <TaskItem task={task} members={members} now={now} language={language} />
        </div>
      ))}
    </Card>
  );
}

export default async function TasksPage() {
  const user = await requireHomeUser();
  const now = new Date();
  const today = todayInZone(now);

  const db = homeDb(user.homeId);
  const assignee = { assignee: { select: { id: true, name: true, photoId: true } } };

  /*
   * Two queries rather than one read and split in memory, unlike the dashboard: that
   * one asks for the next few days only, while this page shows a household's whole
   * history of one-offs, and there is no reason to carry years of finished jobs across
   * just to put them in the second list.
   */
  const [todo, done, memberships] = await Promise.all([
    db.task.findMany({ where: UNFINISHED, orderBy: { nextDueAt: "asc" }, include: assignee }),
    db.task.findMany({
      where: FINISHED,
      orderBy: { lastCompletedAt: "desc" },
      include: assignee,
    }),
    // Who is in this home is its memberships, not its users: somebody in two homes is
    // one account and belongs on both rosters.
    db.homeMember.findMany({
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const members = memberships.map((membership) => membership.user);
  const say = sayIn(user.homeLanguage);

  return (
    <>
      <PageHeader
        title={say(TASKS.title)}
        description={say(TASKS.description)}
        action={
          <FormDialog
            triggerLabel={say(TASKS.newTask)}
            triggerVariant="create"
            triggerShape="icon"
            title={say(TASKS.newTask)}
            submitLabel={say(TASKS.addTask)}
            action={createTask}
          >
            <div className="space-y-1">
              <Label htmlFor="title">{say(TASKS.task)}</Label>
              <Input id="title" name="title" placeholder={say(TASKS.namePlaceholder)} required autoFocus />
            </div>
            {/* Recurring by default: the household's standing jobs are the ones worth
                writing down in advance, and a one-off is usually added because it is
                already on somebody's mind. */}
            <RepeatField intervalDays={7} />
            <div className="space-y-1">
              <Label htmlFor="firstDueAt">{say(TASKS.dueDate)}</Label>
              <Input id="firstDueAt" name="firstDueAt" type="date" defaultValue={today} />
            </div>
            <AssigneeField members={members} language={user.homeLanguage} />
            <div className="space-y-1">
              <Label htmlFor="notes">{say(TASKS.notesOptional)}</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <EmojiField language={user.homeLanguage} />
            <PhotoField hint={say(TASKS.photoHint)} />
          </FormDialog>
        }
      />

      {todo.length === 0 && done.length === 0 ? (
        <EmptyState art="home">{say(TASKS.empty)}</EmptyState>
      ) : todo.length === 0 ? (
        <EmptyState art="mug">{say(TASKS.allDone)}</EmptyState>
      ) : (
        <TaskList tasks={todo} members={members} now={now} language={user.homeLanguage} />
      )}

      {/* Only once something has been finished. A household that keeps no one-offs
          would otherwise carry a permanently empty heading.
          Folded away, like a list's ticked-off items: a year of finished one-offs is
          worth keeping and not worth scrolling past to reach what is still to do. */}
      {done.length > 0 && (
        <section className="mt-8">
          <Collapsible
            summary={say(TASKS.done, { count: done.length })}
            headingClassName="mb-3 text-sm font-semibold text-slate-500 uppercase"
            triggerClassName="hover:text-slate-700"
            panelClassName="pb-1"
          >
            <TaskList tasks={done} members={members} now={now} language={user.homeLanguage} />
          </Collapsible>
        </section>
      )}
    </>
  );
}
