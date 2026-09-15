import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import {
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
} from "@/app/actions/tasks";
import { Badge, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { dueLabel, dueTone } from "@/lib/due";
import { FINISHED, UNFINISHED, isFinished, isOneOff, repeatLabel } from "@/lib/tasks";
import { formatInZone, todayInZone } from "@/lib/time";
import { FormDialog } from "@/components/form-dialog";
import { AssigneeField, type MemberOption } from "@/components/assignee-field";
import { RepeatField } from "@/components/repeat-field";
import { TaskCard } from "@/components/task-card";
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
function historyLine(task: TaskRow) {
  const rhythm = repeatLabel(task);

  if (task.lastCompletedAt) {
    const when = formatInZone(task.lastCompletedAt, "d MMM yyyy");
    return `${rhythm} · ${isFinished(task) ? "done" : "last done"} ${when}`;
  }

  return isOneOff(task) ? rhythm : `${rhythm} · never completed`;
}

/**
 * One task and its edit sheet. Both sections draw the same card: what is done and what
 * is still to do differ in where they sit on the page, not in what they are.
 */
function TaskItem({ task, members, now }: { task: TaskRow; members: MemberOption[]; now: Date }) {
  const finished = isFinished(task);

  return (
    <TaskCard
      taskId={task.id}
      title={task.title}
      finished={finished}
      updateAction={updateTask}
      completeAction={completeTask}
      reopenAction={reopenTask}
      deleteAction={deleteTask}
      photo={<PhotoThumb photoId={task.photoId} alt="" className="h-14 w-14" />}
      summary={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{task.title}</p>
            {/* A finished one-off has no due date worth showing: it came and went, and
                saying how overdue it was would be telling somebody off for a job they
                have already done. */}
            {finished ? (
              <Badge tone="green">Done</Badge>
            ) : (
              <Badge tone={dueTone(task.nextDueAt, now)}>{dueLabel(task.nextDueAt, now)}</Badge>
            )}
            {/* Only when somebody is named: "everyone" is the resting state
                and labelling it on every card would say nothing. */}
            {task.assignee && <Badge>For {task.assignee.name}</Badge>}
          </div>
          {task.notes && <p className="mt-1 text-sm text-slate-600">{task.notes}</p>}
          <p className="mt-1 text-xs text-slate-500">{historyLine(task)}</p>
        </>
      }
    >
      <div className="space-y-1">
        <Label htmlFor={`title-${task.id}`}>Task</Label>
        <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
      </div>
      <RepeatField intervalDays={task.intervalDays} />
      <div className="space-y-1">
        <Label htmlFor={`due-${task.id}`}>{task.intervalDays === null ? "Due" : "Next due"}</Label>
        <Input
          id={`due-${task.id}`}
          name="nextDueAt"
          type="date"
          defaultValue={formatInZone(task.nextDueAt, "yyyy-MM-dd")}
        />
      </div>
      <AssigneeField members={members} selected={task.assigneeId} id={`assignee-${task.id}`} />
      <div className="space-y-1">
        <Label htmlFor={`notes-${task.id}`}>Notes</Label>
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
}: {
  tasks: TaskRow[];
  members: MemberOption[];
  now: Date;
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task, index) => (
        <div
          key={task.id}
          className="animate-row-in"
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
          <TaskItem task={task} members={members} now={now} />
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
  const [todo, done, members] = await Promise.all([
    db.task.findMany({ where: UNFINISHED, orderBy: { nextDueAt: "asc" }, include: assignee }),
    db.task.findMany({
      where: FINISHED,
      orderBy: { lastCompletedAt: "desc" },
      include: assignee,
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="A one-off is done when it is done. Complete a repeating task and it schedules itself again after the interval you set."
        action={
          <FormDialog
            triggerLabel="New task"
            title="New task"
            submitLabel="Add task"
            action={createTask}
          >
            <div className="space-y-1">
              <Label htmlFor="title">Task</Label>
              <Input id="title" name="title" placeholder="Water the plants" required autoFocus />
            </div>
            {/* Recurring by default: the household's standing jobs are the ones worth
                writing down in advance, and a one-off is usually added because it is
                already on somebody's mind. */}
            <RepeatField intervalDays={7} />
            <div className="space-y-1">
              <Label htmlFor="firstDueAt">Due date</Label>
              <Input id="firstDueAt" name="firstDueAt" type="date" defaultValue={today} />
            </div>
            <AssigneeField members={members} />
            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <PhotoField hint="Optional — a picture of the filter, the plant, the meter." />
          </FormDialog>
        }
      />

      {todo.length === 0 && done.length === 0 ? (
        <EmptyState>No tasks yet.</EmptyState>
      ) : todo.length === 0 ? (
        <EmptyState>Nothing left to do.</EmptyState>
      ) : (
        <TaskList tasks={todo} members={members} now={now} />
      )}

      {/* Only once something has been finished. A household that keeps no one-offs
          would otherwise carry a permanently empty heading. */}
      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Done</h2>
          <TaskList tasks={done} members={members} now={now} />
        </section>
      )}
    </>
  );
}
