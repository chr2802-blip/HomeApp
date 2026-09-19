import type { Prisma } from "@prisma/client";
import { calendarDaysBetween, dueAtDaysFrom } from "./time";

/**
 * A task is either a one-off or a recurring one, and `intervalDays` is which: null for
 * the one-off, a number of days for the kind that books itself in again.
 *
 * That makes "finished" a property of the pair of columns rather than a flag of its
 * own. A recurring task is never finished — completing it moves the due date on — so
 * only a one-off with a completion recorded against it has anything left to say. A
 * third column saying the same thing would be a third thing to keep in step, and the
 * one that quietly disagrees is the one every list is then wrong about.
 */
export const FINISHED = {
  intervalDays: null,
  lastCompletedAt: { not: null },
} satisfies Prisma.TaskWhereInput;

/**
 * Everything still on the household's plate: both kinds, minus the one-offs already
 * done.
 *
 * Written as a negation of the above rather than as the `OR` it is equivalent to,
 * because it then occupies a single key. Callers spread it beside their own clauses —
 * the reminder job already has an `OR` of its own — and an `OR` here would silently
 * replace theirs.
 */
export const UNFINISHED = { NOT: FINISHED } satisfies Prisma.TaskWhereInput;

/** Longest repeat a task may be given, and the wording shown when one is refused. */
export const MAX_INTERVAL_DAYS = 3650;
export const INTERVAL_MESSAGE = `Repeat every 1 to ${MAX_INTERVAL_DAYS} days.`;

/**
 * The form field saying which kind of task is being written, and its two values.
 *
 * The kind is submitted in its own right rather than inferred from a blank interval: a
 * number that failed to arrive would otherwise turn a recurring task into a one-off
 * without anybody saying so. A form that does not mention it at all means the recurring
 * kind, which is what every task was before one-offs existed.
 */
export const REPEAT_FIELD = "repeat";
export const REPEAT_ONCE = "once";
export const REPEAT_DAYS = "days";

type TaskKind = { intervalDays: number | null };

/** Whether a task happens once rather than on a repeat. */
export function isOneOff(task: TaskKind) {
  return task.intervalDays === null;
}

/** Whether there is nothing left to do. Only ever true of a one-off. */
export function isFinished(task: TaskKind & { lastCompletedAt: Date | null }) {
  return isOneOff(task) && task.lastCompletedAt !== null;
}

/** How a card describes the task's rhythm, or that it has none. */
export function repeatLabel(task: TaskKind) {
  return isOneOff(task) ? "One-off" : `Every ${task.intervalDays} days`;
}

/**
 * Whether "not today" is a thing somebody could mean about this task.
 *
 * Only a task due today or already overdue: on one due next week, putting it off until
 * tomorrow would be pulling it *forward*, so the entry is not offered there at all.
 * A finished one-off is not due on any day, however long its own date has been in the
 * past, so there is nothing to put off either.
 */
export function isSnoozable(
  task: TaskKind & { lastCompletedAt: Date | null; nextDueAt: Date },
  now: Date = new Date(),
) {
  return !isFinished(task) && calendarDaysBetween(task.nextDueAt, now) <= 0;
}

/**
 * Where snoozing moves a task to: tomorrow morning, in the household's own zone.
 *
 * Never earlier than the task already sat, so the one press cannot bring a date
 * forward — the menu is only offered on what is due today or overdue, but a card left
 * open on a phone overnight is a card offering it about yesterday.
 *
 * The interval is untouched, because snoozing is not a completion: a task that comes
 * round every 30 days still comes round every 30 days, and this moves only the next
 * one. Nothing is recorded about the deferral either — a task put off twice is still a
 * task that has not been done, which is what its date already says.
 */
export function snoozedTo(task: { nextDueAt: Date }, now: Date = new Date()) {
  const tomorrow = dueAtDaysFrom(1, now);
  return tomorrow > task.nextDueAt ? tomorrow : task.nextDueAt;
}
