import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import {
  completeTask,
  createTask,
  reopenTask,
} from "@/app/actions/tasks";
import { Card, EmptyState, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { FINISHED, UNFINISHED, isFinished } from "@/lib/tasks";
import { todayInZone } from "@/lib/time";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { TASKS } from "@/lib/copy/tasks";
import type { HomeLanguage } from "@prisma/client";
import { FormDialog } from "@/components/form-dialog";
import { AssigneeField } from "@/components/assignee-field";
import { RepeatField } from "@/components/repeat-field";
import { SubmitButton } from "@/components/submit-button";
import { TaskDoneButton } from "@/components/task-done-button";
import { TaskRow, type TaskSummary } from "@/components/task-row";
import { EmojiField } from "@/components/emoji-field";
import { Collapsible } from "@/components/collapsible";
import { PhotoField } from "@/components/photo-field";
import {
  TaskDoneSummary,
  TaskMatch,
  TaskMatchGroup,
  TaskSearch,
  type TaskSearchEntry,
} from "@/components/task-search";

type TaskItemRow = TaskSummary & { notes: string | null; assigneeId: string | null };

/** What the search box finds a task by: its name, its notes and who it is for. */
function searchEntry(task: TaskItemRow & { assignee: { name: string } | null }): TaskSearchEntry {
  const text = [task.title, task.notes, task.assignee?.name].filter(Boolean).join("\n");
  return { id: task.id, text: text.toLowerCase() };
}

/**
 * One task as a row of the page's card. Pressing it opens the task's own page, which is
 * where snooze, edit and delete live; the button at the end is the press this page is
 * mostly for, and the only thing beside the name — no three dots, by the household's
 * choice: a row of menus beside a row of Done buttons was furniture.
 *
 * A finished one-off shows the way back instead of Done. It is the same button in the
 * same place because it is the same thought a moment later — pressing Done on the wrong
 * row is the mistake this undoes, and hiding the undo behind the menu would make finding
 * it the hard part.
 */
function TaskItem({
  task,
  now,
  language,
}: {
  task: TaskItemRow;
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
  now,
  language,
}: {
  tasks: TaskItemRow[];
  now: Date;
  language: HomeLanguage;
}) {
  return (
    <TaskMatchGroup ids={tasks.map((task) => task.id)}>
      {/* The rule goes between visible rows rather than `divide-y`, which counts a row
          the search has hidden and leaves a line under the last one still showing. */}
      <Card
        padded={false}
        className="[&>:not([hidden])~:not([hidden])]:border-t [&>:not([hidden])~:not([hidden])]:border-slate-100"
      >
        {tasks.map((task, index) => (
          <TaskMatch key={task.id} id={task.id}>
            <div className="animate-row-in" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
              <TaskItem task={task} now={now} language={language} />
            </div>
          </TaskMatch>
        ))}
      </Card>
    </TaskMatchGroup>
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
            triggerShape="fab"
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
      ) : (
        <TaskSearch entries={[...todo, ...done].map(searchEntry)}>
          {todo.length === 0 ? (
            // Hidden while searching: "everything is done" is not an answer to a search.
            <TaskMatchGroup ids={[]}>
              <EmptyState art="mug">{say(TASKS.allDone)}</EmptyState>
            </TaskMatchGroup>
          ) : (
            <TaskList tasks={todo} now={now} language={user.homeLanguage} />
          )}

          {/* Only once something has been finished. A household that keeps no one-offs
              would otherwise carry a permanently empty heading.
              Folded away, like a list's ticked-off items: a year of finished one-offs is
              worth keeping and not worth scrolling past to reach what is still to do.
              A search counts its matches on the heading and leaves it shut, as the
              lists' does. */}
          {done.length > 0 && (
            <TaskMatchGroup ids={done.map((task) => task.id)} className="mt-8">
              <section>
                <Collapsible
                  summary={<TaskDoneSummary ids={done.map((task) => task.id)} />}
                  headingClassName="mb-3 text-sm font-semibold text-slate-500 uppercase"
                  triggerClassName="hover:text-slate-700"
                  panelClassName="pb-1"
                >
                  <TaskList tasks={done} now={now} language={user.homeLanguage} />
                </Collapsible>
              </section>
            </TaskMatchGroup>
          )}
        </TaskSearch>
      )}
    </>
  );
}
