"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";
import { fail, ok, type ActionResult } from "@/lib/action-result";

async function listInScope(listId: string) {
  const user = await requireHomeUser();
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) throw new Error("List not found");
  assertHomeAccess(user, list.homeId);
  return list;
}

export async function createList(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Give the list a name.");

  const list = await prisma.list.create({
    data: { title, homeId: user.homeId, createdById: user.id },
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
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Give the list a name.");

  await prisma.list.update({ where: { id: list.id }, data: { title } });

  revalidatePath(`/lists/${list.id}`);
  revalidatePath("/lists");
  return ok();
}

export async function addListItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const list = await listInScope(String(formData.get("listId")));
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return fail("Write something to add.");

  const last = await prisma.listItem.findFirst({
    where: { listId: list.id },
    orderBy: { position: "desc" },
  });

  await prisma.listItem.create({
    data: { listId: list.id, text, position: (last?.position ?? 0) + 1 },
  });

  revalidatePath(`/lists/${list.id}`);
  return ok();
}

export async function toggleListItem(formData: FormData) {
  const user = await requireHomeUser();
  const item = await prisma.listItem.findUnique({
    where: { id: String(formData.get("itemId")) },
    include: { list: true },
  });
  if (!item) return;
  assertHomeAccess(user, item.list.homeId);

  await prisma.listItem.update({
    where: { id: item.id },
    data: { done: !item.done },
  });

  revalidatePath(`/lists/${item.listId}`);
}

export async function deleteListItem(formData: FormData) {
  const user = await requireHomeUser();
  const item = await prisma.listItem.findUnique({
    where: { id: String(formData.get("itemId")) },
    include: { list: true },
  });
  if (!item) return;
  assertHomeAccess(user, item.list.homeId);

  await prisma.listItem.delete({ where: { id: item.id } });
  revalidatePath(`/lists/${item.listId}`);
}

export async function clearCompletedItems(formData: FormData) {
  const list = await listInScope(String(formData.get("listId")));
  await prisma.listItem.deleteMany({ where: { listId: list.id, done: true } });
  revalidatePath(`/lists/${list.id}`);
}
