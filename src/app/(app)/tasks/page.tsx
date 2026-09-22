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
import { Badge, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { dueLabel, dueTone } from "@/lib/due";
import {
  FINISHED,
  UNFINISHED,
  isFinished,
  isOneOff,
  isSnoozable,
  repeatLabel,
} from "@/lib/tasks";
import { formatInZone, readInZone, todayInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { sayIn } from "@/lib/copy/say";
import { TASKS } from "@/lib/copy/tasks";
import type { HomeLanguage } from "@prisma/client";
import { FormDialog } from "@/components/form-dialog";
import { AssigneeField, type MemberOption } from "@/components/assignee-field";
import { RepeatField } from "@/components/repeat-field";
import { TaskCard } from "@/components/task-card";
import { Collapsible } from "@/components/collapsible";
import { PhotoField } from "@/components/photo-field";
import { PhotoThumb } from "@/components/photo";

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  intervalDays: number | null;
  nextDueAt: Date;
  lastCompletedAt: Date | null;
  assigneeId: string | null;
  photoId: string | null;
  assignee: { id: string; name: string } | null;
};

/**
 * The line under the title: how often the task comes round, and what it has to say
 * about the last time it was done.
 *
 * A one-off that has never been done says only what it is — "never completed" belongs
 * to a task that keeps coming back, where it means nobody has got to it yet. On a thing
 * you do once it would read as a reproach.
 */
function historyLine(task: TaskRow, language: HomeLanguage) {
  const say = sayIn(language);
  const rhythm = repeatLabel(task, language);

  if (task.lastCompletedAt) {
    const when = readInZone(task.lastCompletedAt, DATE.dayMonthYear, language);
    return isFinished(task)
      ? say(TASKS.doneOn, { rhythm, when })
      : say(TASKS.lastDoneOn, { rhythm, when });
  }

  return isOneOff(task) ? rhythm : say(TASKS.neverCompleted, { rhythm });
}

/**
 * One task and its edit sheet. Both sections draw the same card: what is done and what
 * is still to do differ in where they sit on the page, not in what they are.
 */
function TaskItem({
  task,
  members,
  now,
  language,
}: {
  task: TaskRow;
  members: MemberOption[];
  now: Date;
  language: HomeLanguage;
}) {
  const finished = isFinished(task);
  const say = sayIn(language);

  return (
    <TaskCard
      taskId={task.id}
      title={task.title}
      finished={finished}
      snoozable={isSnoozable(task, now)}
      updateAction={updateTask}
      completeAction={completeTask}
      snoozeAction={snoozeTask}
      reopenAction={reopenTask}
      deleteAction={deleteTask}
      photo={
        // eslint-disable-next-line no-restricted-syntax -- `placeholder` picks a PhotoKind glyph, not copy.
        <PhotoThumb photoId={task.photoId} alt="" className="h-14 w-14" placeholder="task" />
      }
      summary={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{task.title}</p>
            {/* A finished one-off has no due date worth showing: it came and went, and
                saying how overdue it was would be telling somebody off for a job they
                have already done. */}
            {finished ? (
              <Badge tone="green">{say(TASKS.doneBadge)}</Badge>
            ) : (
              <Badge tone={dueTone(task.nextDueAt, now)}>{dueLabel(task.nextDueAt, language, now)}</Badge>
            )}
            {/* Only when somebody is named: "everyone" is the resting state
                and labelling it on every card would say nothing. */}
            {task.assignee && <Badge>{say(TASKS.forName, { name: task.assignee.name })}</Badge>}
          </div>
          {task.notes && <p className="mt-1 text-sm text-slate-600">{task.notes}</p>}
          <p className="mt-1 text-xs text-slate-500">{historyLine(task, language)}</p>
        </>
      }
    >
      <div className="space-y-1">
        <Label htmlFor={`title-${task.id}`}>{say(TASKS.taskField)}</Label>
        <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
      </div>
      <RepeatField intervalDays={task.intervalDays} />
      <div className="space-y-1">
        <Label htmlFor={`due-${task.id}`}>
          {task.intervalDays === null ? say(TASKS.due) : say(TASKS.nextDue)}
        </Label>
        <Input
          id={`due-${task.id}`}
          name="nextDueAt"
          type="date"
          defaultValue={formatInZone(task.nextDueAt, "yyyy-MM-dd")}
        />
      </div>
      <AssigneeField
        members={members}
        selected={task.assigneeId}
        id={`assignee-${task.id}`}
        language={language}
      />
      <div className="space-y-1">
        <Label htmlFor={`notes-${task.id}`}>{say(TASKS.notes)}</Label>
        <Textarea id={`notes-${task.id}`} name="notes" rows={2} defaultValue={task.notes ?? ""} />
      </div>
      <PhotoField defaultPhotoId={task.photoId} />
    </TaskCard>
  );
}

function TaskList({
  tasks,
  members,
  now,
  language,
}: {
  tasks: TaskRow[];
  members: MemberOption[];
  now: Date;
  language: HomeLanguage;
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <div
          key={task.id}
          className="animate-row-in"
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
          <TaskItem task={task} members={members} now={now} language={language} />
        </div>
      ))}
    </div>
  );
}

export default async function TasksPage() {
  const user = await requireHomeUser();
  const now = new Date();
  const today = todayInZone(now);

  const db = homeDb(user.homeId);
  const assignee = { assignee: { select: { id: true, name: true } } };

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
            <PhotoField hint={say(TASKS.photoHint)} />
          </FormDialog>
        }
      />

      {todo.length === 0 && done.length === 0 ? (
        <EmptyState icon="🧺">{say(TASKS.empty)}</EmptyState>
      ) : todo.length === 0 ? (
        <EmptyState icon="✨">{say(TASKS.allDone)}</EmptyState>
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
