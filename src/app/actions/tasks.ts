"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";

function startOfDayFrom(date: Date, daysAhead: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + daysAhead);
  next.setHours(9, 0, 0, 0);
  return next;
}

function parseIntervalDays(value: FormDataEntryValue | null) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) return null;
  return days;
}

async function taskInScope(taskId: string) {
  const user = await requireHomeUser();
  const task = await prisma.recurringTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  assertHomeAccess(user, task.homeId);
  return task;
}

export async function createTask(formData: FormData) {
  const user = await requireHomeUser();
  const title = String(formData.get("title") ?? "").trim();
  const intervalDays = parseIntervalDays(formData.get("intervalDays"));
  if (!title || !intervalDays) return;

  const notes = String(formData.get("notes") ?? "").trim();
  const firstDueRaw = String(formData.get("firstDueAt") ?? "");
  const firstDue = firstDueRaw ? new Date(`${firstDueRaw}T09:00:00`) : startOfDayFrom(new Date(), 0);

  await prisma.recurringTask.create({
    data: {
      homeId: user.homeId,
      title,
      notes: notes || null,
      intervalDays,
      nextDueAt: Number.isNaN(firstDue.getTime()) ? startOfDayFrom(new Date(), 0) : firstDue,
      createdById: user.id,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function updateTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  const title = String(formData.get("title") ?? "").trim();
  const intervalDays = parseIntervalDays(formData.get("intervalDays"));
  if (!title || !intervalDays) return;

  const notes = String(formData.get("notes") ?? "").trim();
  const nextDueRaw = String(formData.get("nextDueAt") ?? "");
  const nextDue = nextDueRaw ? new Date(`${nextDueRaw}T09:00:00`) : task.nextDueAt;

  await prisma.recurringTask.update({
    where: { id: task.id },
    data: {
      title,
      notes: notes || null,
      intervalDays,
      nextDueAt: Number.isNaN(nextDue.getTime()) ? task.nextDueAt : nextDue,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function completeTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  const now = new Date();

  await prisma.recurringTask.update({
    where: { id: task.id },
    data: {
      lastCompletedAt: now,
      nextDueAt: startOfDayFrom(now, task.intervalDays),
      lastNotifiedAt: null,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function deleteTask(formData: FormData) {
  const task = await taskInScope(String(formData.get("taskId")));
  await prisma.recurringTask.delete({ where: { id: task.id } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
