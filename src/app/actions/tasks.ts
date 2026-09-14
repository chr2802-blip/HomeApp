"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { homeScoped } from "@/lib/scoped";
import { optionalText, readForm, requiredText } from "@/lib/form";
import { dueAtDaysFrom, dueAtOn } from "@/lib/time";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const MAX_INTERVAL_DAYS = 3650;
const INTERVAL_MESSAGE = `Repeat every 1 to ${MAX_INTERVAL_DAYS} days.`;

const taskInScope = homeScoped("Task", (id) =>
  prisma.recurringTask.findUnique({ where: { id } }),
);

/** Create and edit take the same fields; only the name of the date differs. */
const taskSchema = z.object({
  title: requiredText("Give the task a name."),
  intervalDays: z.coerce
    .number({ error: INTERVAL_MESSAGE })
    .int(INTERVAL_MESSAGE)
    .min(1, INTERVAL_MESSAGE)
    .max(MAX_INTERVAL_DAYS, INTERVAL_MESSAGE),
  notes: optionalText,
});

function refreshTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
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

  const member = await homeDb(homeId).user.findUnique({ where: { id } });
  return member ? { ok: true as const, assigneeId: member.id } : { ok: false as const };
}

const NOT_A_MEMBER = "That person is not in this home.";

/** A blank date means "leave it alone"; anything else has to be a real date. */
function readDueDate(formData: FormData, field: string, label: string) {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return { ok: true as const, dueAt: null };

  const dueAt = dueAtOn(raw);
  return dueAt ? { ok: true as const, dueAt } : { ok: false as const, label };
}

export async function createTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readForm(taskSchema, formData);
  if (!form.ok) return fail(form.error);

  const due = readDueDate(formData, "firstDueAt", "That first due date is not a real date.");
  if (!due.ok) return fail(due.label);

  const assignee = await readAssignee(formData, user.homeId);
  if (!assignee.ok) return fail(NOT_A_MEMBER);

  await prisma.recurringTask.create({
    data: {
      ...form.fields,
      homeId: user.homeId,
      nextDueAt: due.dueAt ?? dueAtDaysFrom(0),
      assigneeId: assignee.assigneeId,
      createdById: user.id,
    },
  });

  refreshTaskViews();
  return ok();
}

export async function updateTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const task = await taskInScope(String(formData.get("taskId")));
  const form = readForm(taskSchema, formData);
  if (!form.ok) return fail(form.error);

  const due = readDueDate(formData, "nextDueAt", "That due date is not a real date.");
  if (!due.ok) return fail(due.label);

  const assignee = await readAssignee(formData, task.homeId);
  if (!assignee.ok) return fail(NOT_A_MEMBER);

  await prisma.recurringTask.update({
    where: { id: task.id },
    data: {
      ...form.fields,
      nextDueAt: due.dueAt ?? task.nextDueAt,
      assigneeId: assignee.assigneeId,
    },
  });

  refreshTaskViews();
  return ok();
}

export async function completeTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  const now = new Date();

  await prisma.recurringTask.update({
    where: { id: task.id },
    data: {
      lastCompletedAt: now,
      nextDueAt: dueAtDaysFrom(task.intervalDays, now),
      lastNotifiedAt: null,
    },
  });

  refreshTaskViews();
}

export async function deleteTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  await prisma.recurringTask.delete({ where: { id: task.id } });
  refreshTaskViews();
}
