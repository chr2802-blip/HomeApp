"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { homeScoped } from "@/lib/scoped";
import { optionalText, readForm, requiredText } from "@/lib/form";
import { dueAtDaysFrom, dueAtOn } from "@/lib/time";
import { discardPhoto, discardReplaced, readPhotoChoice } from "@/lib/photos";
import {
  MAX_INTERVAL_DAYS,
  REPEAT_FIELD,
  REPEAT_ONCE,
  isFinished,
  isOneOff,
  snoozedTo,
} from "@/lib/tasks";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sayIn, type Say } from "@/lib/copy/say";
import { TASKS } from "@/lib/copy/tasks";

const taskInScope = homeScoped("Task", (id) => prisma.task.findUnique({ where: { id } }));

/** Create and edit take the same fields; only the name of the date differs. */
function taskSchema(say: Say) {
  return z.object({
    title: requiredText(say(TASKS.nameRequired)),
    notes: optionalText,
  });
}

function intervalSchema(say: Say) {
  const message = say(TASKS.intervalMessage, { max: MAX_INTERVAL_DAYS });
  return z.coerce.number({ error: message }).int(message).min(1, message).max(MAX_INTERVAL_DAYS, message);
}

function refreshTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

/**
 * How often the task comes back, or null when it is a one-off.
 *
 * The repeat picker says which kind it is in its own field, so an interval arriving
 * alongside "just once" is ignored rather than argued with: the person chose the kind,
 * and the number is left over from the box that was on screen a moment earlier.
 *
 * A form that says nothing about the kind is read as recurring, which is what every
 * task was before one-offs existed — so an interval is still required, and still
 * checked, for anything that has not opted in.
 */
function readInterval(formData: FormData, say: Say) {
  if (String(formData.get(REPEAT_FIELD) ?? "") === REPEAT_ONCE) {
    return { ok: true as const, intervalDays: null };
  }

  const parsed = intervalSchema(say).safeParse(formData.get("intervalDays"));
  return parsed.success
    ? { ok: true as const, intervalDays: parsed.data }
    : { ok: false as const, error: parsed.error.issues[0]?.message ?? say(TASKS.intervalMessage, { max: MAX_INTERVAL_DAYS }) };
}

/**
 * The member a task is being handed to, checked against the home before it is stored.
 *
 * The picker only offers this home's members, but the value arrives in a form and a
 * form can say anything. Asking through `homeDb` makes the check the query itself:
 * another household's member is simply not found, so there is no comparison to forget.
 *
 * A blank value means the whole household, which is what an unassigned task has always
 * meant.
 */
async function readAssignee(formData: FormData, homeId: string) {
  const id = String(formData.get("assigneeId") ?? "").trim();
  if (!id) return { ok: true as const, assigneeId: null };

  const member = await homeDb(homeId).homeMember.findFirst({ where: { userId: id } });
  return member ? { ok: true as const, assigneeId: member.userId } : { ok: false as const };
}

/** A blank date means "leave it alone"; anything else has to be a real date. */
function readDueDate(formData: FormData, field: string, label: string) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return { ok: true as const, dueAt: null };

  const dueAt = dueAtOn(raw);
  return dueAt ? { ok: true as const, dueAt } : { ok: false as const, label };
}

export async function createTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const form = readForm(taskSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  const repeat = readInterval(formData, say);
  if (!repeat.ok) return fail(repeat.error);

  const due = readDueDate(formData, "firstDueAt", say(TASKS.firstDueNotReal));
  if (!due.ok) return fail(due.label);

  const assignee = await readAssignee(formData, user.homeId);
  if (!assignee.ok) return fail(say(TASKS.notAMember));

  const photo = await readPhotoChoice(formData, user.homeId, user.homeLanguage);
  if (!photo.ok) return fail(photo.error);

  await prisma.task.create({
    data: {
      ...form.fields,
      homeId: user.homeId,
      intervalDays: repeat.intervalDays,
      nextDueAt: due.dueAt ?? dueAtDaysFrom(0),
      assigneeId: assignee.assigneeId,
      photoId: photo.photoId ?? null,
      createdById: user.id,
    },
  });

  refreshTaskViews();
  return ok();
}

export async function updateTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const task = await taskInScope(String(formData.get("taskId")));
  const form = readForm(taskSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  const repeat = readInterval(formData, say);
  if (!repeat.ok) return fail(repeat.error);

  const due = readDueDate(formData, "nextDueAt", say(TASKS.dueNotReal));
  if (!due.ok) return fail(due.label);

  const assignee = await readAssignee(formData, task.homeId);
  if (!assignee.ok) return fail(say(TASKS.notAMember));

  const photo = await readPhotoChoice(formData, task.homeId, user.homeLanguage);
  if (!photo.ok) return fail(photo.error);

  await prisma.task.update({
    where: { id: task.id },
    data: {
      ...form.fields,
      intervalDays: repeat.intervalDays,
      nextDueAt: due.dueAt ?? task.nextDueAt,
      assigneeId: assignee.assigneeId,
      photoId: photo.photoId,
      // Giving a finished one-off a repeat brings it back to life, and a task that is
      // back on the list has not been done yet. Left alone it would show as recurring
      // and completed on a date it will never come round to again.
      ...(isOneOff(task) && repeat.intervalDays !== null && { lastCompletedAt: null }),
    },
  });

  // Only once the row no longer points at it, so a failed update cannot leave a task
  // holding a picture that has already gone.
  await discardReplaced(task.homeId, task.photoId, photo.photoId);

  refreshTaskViews();
  return ok();
}

export async function completeTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  const now = new Date();

  await prisma.task.update({
    where: { id: task.id },
    data: {
      lastCompletedAt: now,
      lastNotifiedAt: null,
      // A recurring task books itself in again, counted from today rather than from the
      // date it slipped past. A one-off is finished, so its date stays where it was:
      // moving it on would put a done thing back in the diary. Spelled out rather than
      // asked through `isOneOff`, which reads the same but tells the compiler nothing
      // about the number below it.
      ...(task.intervalDays !== null && { nextDueAt: dueAtDaysFrom(task.intervalDays, now) }),
    },
  });

  refreshTaskViews();
}

/**
 * Puts a task off until tomorrow, without completing it and without opening its form.
 *
 * "Not today" is the most common thing a household has to say about a due task, and
 * until now the only two ways of saying it were a completion it had not earned and a
 * trip through the edit sheet to type a date. So this writes the one column that answers
 * it and nothing else: the interval stays, `lastCompletedAt` stays, and no record of the
 * deferral is kept — a task put off three times is still a task nobody has done, which
 * is what its due date already says.
 *
 * `lastNotifiedAt` is deliberately left alone. It is the reminder job's own bookkeeping,
 * and clearing it would ask for a second push about a task somebody has just told the
 * app they are not doing today; tomorrow's run is a day later than today's and so past
 * the job's own cutoff anyway.
 *
 * A finished one-off is not due on any day, so there is nothing to put off — the same
 * early return `reopenTask` makes for the mirror-image case.
 */
export async function snoozeTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  if (isFinished(task)) return;

  await prisma.task.update({
    where: { id: task.id },
    data: { nextDueAt: snoozedTo(task) },
  });

  refreshTaskViews();
}

/**
 * Puts a finished one-off back on the list — the undo for a "Mark done" pressed on the
 * wrong card.
 *
 * The due date is left where it was rather than moved to today: the task was due when
 * it was due, and something marked done by mistake should come back looking exactly as
 * it did.
 */
export async function reopenTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));

  // Only a one-off is ever finished, so only a one-off has anything to reopen. A
  // recurring task reaching here would lose the date it was last done for nothing.
  if (!isOneOff(task)) return;

  await prisma.task.update({ where: { id: task.id }, data: { lastCompletedAt: null } });

  refreshTaskViews();
}

export async function deleteTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  await prisma.task.delete({ where: { id: task.id } });
  // Nothing else can be pointing at it: a picture belongs to the one thing it was
  // added to.
  await discardPhoto(task.homeId, task.photoId);
  refreshTaskViews();
}
