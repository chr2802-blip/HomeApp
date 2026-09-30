import Link from "next/link";
import type { HomeLanguage } from "@prisma/client";
import { PhotoThumb } from "@/components/photo";
import { Input, Label, Textarea } from "@/components/ui";
import { RepeatField } from "@/components/repeat-field";
import { AssigneeField, type MemberOption } from "@/components/assignee-field";
import { PhotoField } from "@/components/photo-field";
import { PersonMark } from "@/components/person-mark";
import { EmojiField } from "@/components/emoji-field";
import { faceOf } from "@/lib/emoji";
import { dueLabel, dueTone } from "@/lib/due";
import { isFinished, isOneOff, repeatLabel } from "@/lib/tasks";
import { formatInZone, readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { sayIn } from "@/lib/copy/say";
import { TASKS } from "@/lib/copy/tasks";

/** What a row, the details page and the edit sheet need to know about a task. */
export type TaskSummary = {
  id: string;
  title: string;
  intervalDays: number | null;
  nextDueAt: Date;
  lastCompletedAt: Date | null;
  photoId: string | null;
  /** The household's chosen face, or null to guess one from the title (`faceOf`). */
  emoji: string | null;
  assignee: { name: string; photoId: string | null } | null;
};

/** The due line's colour: the same meanings the details page's badge carries. */
export const TONE_TEXT: Record<ReturnType<typeof dueTone>, string> = {
  neutral: "text-slate-500",
  red: "text-red-600",
  amber: "text-amber-700",
};

/**
 * How often the task comes round, and what it has to say about the last time it was
 * done.
 *
 * A one-off that has never been done says only what it is — "never completed" belongs
 * to a task that keeps coming back, where it means nobody has got to it yet. On a thing
 * you do once it would read as a reproach.
 */
export function historyLine(task: TaskSummary, language: HomeLanguage) {
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
 * One task as a row: its picture, its name, and one line saying when it is due. The
 * whole left of the row is a link to the task's own page, where the notes, the history
 * and the bigger picture live — the row carries only what somebody scanning the list
 * decides on.
 *
 * `trailing` is what sits to the right of the link — the three dots and the Done button
 * — as siblings rather than inside it, because a link cannot hold a button.
 *
 * The same row on `/tasks` and on the dashboard, so the two cannot drift apart. It is a
 * plain component rendered from server pages, so it takes `language` as a prop.
 */
export function TaskRow({
  task,
  now,
  language,
  trailing,
  showWho = false,
}: {
  task: TaskSummary;
  now: Date;
  language: HomeLanguage;
  trailing?: React.ReactNode;
  /**
   * Whether the tile carries the assignee's mark in its corner. On `/tasks`, and under
   * the dashboard's "due for someone else"; not under "due for you", where it would be
   * your own face on every row, saying nothing the heading did not.
   */
  showWho?: boolean;
}) {
  const finished = isFinished(task);

  return (
    <div className="flex items-center gap-1 py-0.5 pr-3 pl-1">
      <Link
        href={`/tasks/${task.id}`}
        className="pressable flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50 active:scale-[0.98] active:bg-slate-100"
      >
        {/* Decorative: the task's own name is right beside it. */}
        <span className="relative shrink-0">
          <PhotoThumb
            photoId={task.photoId}
            alt=""
            className="h-10 w-10"
            placeholder="task"
            emoji={faceOf(task)}
          />
          {/* Decoration: the name is in the line beside it. */}
          {showWho && task.assignee && (
            <PersonMark
              name={task.assignee.name}
              photoId={task.assignee.photoId}
              className="absolute -right-1.5 -bottom-1.5 h-5 w-5 ring-2 ring-white"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{task.title}</p>
          <p className="truncate text-xs">
            {/* A finished one-off has no due date worth showing: it came and went, and
                saying how overdue it was would be telling somebody off for a job
                already done. */}
            {finished ? (
              <span className="text-slate-500">{historyLine(task, language)}</span>
            ) : (
              <>
                <span className={TONE_TEXT[dueTone(task.nextDueAt, now)]}>
                  {dueLabel(task.nextDueAt, language, now)}
                </span>
                <span className="text-slate-400">
                  {" · "}
                  {repeatLabel(task, language)}
                  {task.assignee && ` · ${task.assignee.name}`}
                </span>
              </>
            )}
          </p>
        </div>
      </Link>
      {trailing}
    </div>
  );
}

/**
 * The edit sheet's fields, shared by the row's three dots on `/tasks` and the task's
 * own page.
 */
export function TaskFields({
  task,
  members,
  language,
}: {
  task: TaskSummary & { notes: string | null; assigneeId: string | null };
  members: MemberOption[];
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <>
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
      <EmojiField selected={task.emoji} idPrefix={`emoji-${task.id}`} language={language} />
      <PhotoField defaultPhotoId={task.photoId} />
    </>
  );
}
