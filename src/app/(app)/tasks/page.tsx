import { requireHomeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { completeTask, createTask, deleteTask, updateTask } from "@/app/actions/tasks";
import { Badge, Card, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { dueLabel, dueTone } from "@/lib/due";
import { formatInZone, todayInZone } from "@/lib/time";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";

export default async function TasksPage() {
  const user = await requireHomeUser();
  const now = new Date();
  const today = todayInZone(now);

  const tasks = await prisma.recurringTask.findMany({
    where: { homeId: user.homeId },
    orderBy: { nextDueAt: "asc" },
  });

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
            <Card
              key={task.id}
              className="animate-row-in"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{task.title}</p>
                    <Badge tone={dueTone(task.nextDueAt, now)}>
                      {dueLabel(task.nextDueAt, now)}
                    </Badge>
                  </div>
                  {task.notes && <p className="mt-1 text-sm text-slate-600">{task.notes}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    Every {task.intervalDays} days
                    {task.lastCompletedAt
                      ? ` · last done ${formatInZone(task.lastCompletedAt, "d MMM yyyy")}`
                      : " · never completed"}
                  </p>
                </div>
                <form action={completeTask}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <SubmitButton pendingLabel="Saving…">Mark done</SubmitButton>
                </form>
              </div>

              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <FormDialog
                  triggerLabel="Edit"
                  triggerVariant="secondary"
                  triggerIcon="pencil"
                  title="Edit task"
                  submitLabel="Save changes"
                  action={updateTask}
                >
                  <input type="hidden" name="taskId" value={task.id} />
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
                  <div className="space-y-1">
                    <Label htmlFor={`notes-${task.id}`}>Notes</Label>
                    <Textarea
                      id={`notes-${task.id}`}
                      name="notes"
                      rows={2}
                      defaultValue={task.notes ?? ""}
                    />
                  </div>
                </FormDialog>

                <form action={deleteTask}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <ConfirmButton message={`Delete the recurring task "${task.title}"?`}>
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
