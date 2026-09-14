import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { completeTask, createTask, deleteTask, updateTask } from "@/app/actions/tasks";
import { Badge, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { dueLabel, dueTone } from "@/lib/due";
import { formatInZone, todayInZone } from "@/lib/time";
import { FormDialog } from "@/components/form-dialog";
import { AssigneeField } from "@/components/assignee-field";
import { TaskCard } from "@/components/task-card";

export default async function TasksPage() {
  const user = await requireHomeUser();
  const now = new Date();
  const today = todayInZone(now);

  const db = homeDb(user.homeId);

  const [tasks, members] = await Promise.all([
    db.recurringTask.findMany({
      orderBy: { nextDueAt: "asc" },
      include: { assignee: { select: { id: true, name: true } } },
    }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Recurring tasks"
        description="Complete a task and it schedules itself again after the interval you set."
        action={
          <FormDialog
            triggerLabel="New task"
            title="New recurring task"
            submitLabel="Add task"
            action={createTask}
          >
            <div className="space-y-1">
              <Label htmlFor="title">Task</Label>
              <Input id="title" name="title" placeholder="Water the plants" required autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="intervalDays">Repeat every (days)</Label>
                <Input
                  id="intervalDays"
                  name="intervalDays"
                  type="number"
                  min={1}
                  max={3650}
                  defaultValue={7}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="firstDueAt">First due date</Label>
                <Input id="firstDueAt" name="firstDueAt" type="date" defaultValue={today} />
              </div>
            </div>
            <AssigneeField members={members} />
            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
          </FormDialog>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState>No recurring tasks yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="animate-row-in"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <TaskCard
                taskId={task.id}
                title={task.title}
                updateAction={updateTask}
                completeAction={completeTask}
                deleteAction={deleteTask}
                summary={
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{task.title}</p>
                      <Badge tone={dueTone(task.nextDueAt, now)}>
                        {dueLabel(task.nextDueAt, now)}
                      </Badge>
                      {/* Only when somebody is named: "everyone" is the resting state
                          and labelling it on every card would say nothing. */}
                      {task.assignee && <Badge>For {task.assignee.name}</Badge>}
                    </div>
                    {task.notes && <p className="mt-1 text-sm text-slate-600">{task.notes}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      Every {task.intervalDays} days
                      {task.lastCompletedAt
                        ? ` · last done ${formatInZone(task.lastCompletedAt, "d MMM yyyy")}`
                        : " · never completed"}
                    </p>
                  </>
                }
              >
                <div className="space-y-1">
                  <Label htmlFor={`title-${task.id}`}>Task</Label>
                  <Input id={`title-${task.id}`} name="title" defaultValue={task.title} required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`interval-${task.id}`}>Repeat every (days)</Label>
                    <Input
                      id={`interval-${task.id}`}
                      name="intervalDays"
                      type="number"
                      min={1}
                      max={3650}
                      defaultValue={task.intervalDays}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`due-${task.id}`}>Next due</Label>
                    <Input
                      id={`due-${task.id}`}
                      name="nextDueAt"
                      type="date"
                      defaultValue={formatInZone(task.nextDueAt, "yyyy-MM-dd")}
                    />
                  </div>
                </div>
                <AssigneeField
                  members={members}
                  selected={task.assigneeId}
                  id={`assignee-${task.id}`}
                />
                <div className="space-y-1">
                  <Label htmlFor={`notes-${task.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${task.id}`}
                    name="notes"
                    rows={2}
                    defaultValue={task.notes ?? ""}
                  />
                </div>
              </TaskCard>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
