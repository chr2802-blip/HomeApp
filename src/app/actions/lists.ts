"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";
import { homeScoped } from "@/lib/scoped";
import { readForm, requiredText } from "@/lib/form";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const listInScope = homeScoped("List", (id) => prisma.list.findUnique({ where: { id } }));

const titleSchema = z.object({ title: requiredText("Give the list a name.") });
const itemSchema = z.object({ text: requiredText("Write something to add.") });

export async function createList(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readForm(titleSchema, formData);
  if (!form.ok) return fail(form.error);

  const list = await prisma.list.create({
    data: { title: form.fields.title, homeId: user.homeId, createdById: user.id },
  });

  revalidatePath("/lists");
  redirect(`/lists/${list.id}`);
}

export async function deleteList(formData: FormData) {
  const list = await listInScope(String(formData.get("listId")));
  await prisma.list.delete({ where: { id: list.id } });
  revalidatePath("/lists");
  redirect("/lists");
}

export async function renameList(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const list = await listInScope(String(formData.get("listId")));
  const form = readForm(titleSchema, formData);
  if (!form.ok) return fail(form.error);

  await prisma.list.update({ where: { id: list.id }, data: { title: form.fields.title } });

  revalidatePath(`/lists/${list.id}`);
  revalidatePath("/lists");
  return ok();
}

export async function addListItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const list = await listInScope(String(formData.get("listId")));
  const form = readForm(itemSchema, formData);
  if (!form.ok) return fail(form.error);

  const last = await prisma.listItem.findFirst({
    where: { listId: list.id },
    orderBy: { position: "desc" },
  });

  await prisma.listItem.create({
    data: { listId: list.id, text: form.fields.text, position: (last?.position ?? 0) + 1 },
  });

  revalidatePath(`/lists/${list.id}`);
  return ok();
}

/** Items are reached through their list, which is what carries the home. */
async function itemInScope(itemId: string) {
  const user = await requireHomeUser();
  const item = await prisma.listItem.findUnique({
    where: { id: itemId },
    include: { list: true },
  });
  if (!item) return null;
  assertHomeAccess(user, item.list.homeId);
  return item;
}

export async function toggleListItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await prisma.listItem.update({ where: { id: item.id }, data: { done: !item.done } });
  revalidatePath(`/lists/${item.listId}`);
}

export async function deleteListItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await prisma.listItem.delete({ where: { id: item.id } });
  revalidatePath(`/lists/${item.listId}`);
}

export async function clearCompletedItems(formData: FormData) {
  const list = await listInScope(String(formData.get("listId")));
  await prisma.listItem.deleteMany({ where: { listId: list.id, done: true } });
  revalidatePath(`/lists/${list.id}`);
}
