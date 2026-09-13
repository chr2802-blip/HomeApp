"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";
import { dueAtDaysFrom, dueAtOn } from "@/lib/time";
import { fail, invalid, ok, parsed, type ActionResult } from "@/lib/action-result";

const MAX_INTERVAL_DAYS = 3650;

function parseIntervalDays(value: FormDataEntryValue | null) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > MAX_INTERVAL_DAYS) return null;
  return days;
}

function refreshTaskViews() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

type TaskFields = { title: string; intervalDays: number; notes: string | null };

async function taskInScope(taskId: string) {
  const user = await requireHomeUser();
  const task = await prisma.recurringTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  assertHomeAccess(user, task.homeId);
  return task;
}

/** Shared by create and edit, which take the same fields. */
function readTaskForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return invalid<TaskFields>("Give the task a name.");

  const intervalDays = parseIntervalDays(formData.get("intervalDays"));
  if (!intervalDays) return invalid<TaskFields>(`Repeat every 1 to ${MAX_INTERVAL_DAYS} days.`);

  return parsed<TaskFields>({
    title,
    intervalDays,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
}

export async function createTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readTaskForm(formData);
  if (!form.ok) return fail(form.error);

  const firstDueRaw = String(formData.get("firstDueAt") ?? "");
  if (firstDueRaw && !dueAtOn(firstDueRaw)) return fail("That first due date is not a real date.");

  await prisma.recurringTask.create({
    data: {
      ...form.fields,
      homeId: user.homeId,
      nextDueAt: dueAtOn(firstDueRaw) ?? dueAtDaysFrom(0),
      createdById: user.id,
    },
  });

  refreshTaskViews();
  return ok();
}

export async function updateTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const task = await taskInScope(String(formData.get("taskId")));
  const form = readTaskForm(formData);
  if (!form.ok) return fail(form.error);

  const nextDueRaw = String(formData.get("nextDueAt") ?? "");
  if (nextDueRaw && !dueAtOn(nextDueRaw)) return fail("That due date is not a real date.");

  await prisma.recurringTask.update({
    where: { id: task.id },
    data: { ...form.fields, nextDueAt: dueAtOn(nextDueRaw) ?? task.nextDueAt },
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
