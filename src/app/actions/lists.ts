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

/** One past the furthest item, so a new or restored item lands at the bottom. */
async function nextPosition(listId: string) {
  const last = await prisma.listItem.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1;
}

/**
 * Adding something already on the list brings it back rather than duplicating it.
 *
 * A shopping list is written the same way most weeks, and once everything is ticked
 * off the old entries are exactly the vocabulary for the next shop. Typing "Milk" when
 * a ticked "Milk" is sitting there should mean "I need milk again", not "make a second
 * milk".
 */
export async function addListItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const list = await listInScope(String(formData.get("listId")));
  const form = readForm(itemSchema, formData);
  if (!form.ok) return fail(form.error);

  const text = form.fields.text;
  const existing = await prisma.listItem.findFirst({
    where: { listId: list.id, text: { equals: text, mode: "insensitive" } },
    orderBy: { done: "desc" },
  });

  if (existing?.done) {
    await restore(existing.id, list.id);
    revalidatePath(`/lists/${list.id}`);
    return ok();
  }

  if (existing) return fail(`"${existing.text}" is already on the list.`);

  await prisma.listItem.create({
    data: { listId: list.id, text, position: await nextPosition(list.id) },
  });

  revalidatePath(`/lists/${list.id}`);
  return ok();
}

/** Unticks an item and moves it to the end of what is still outstanding. */
async function restore(itemId: string, listId: string) {
  await prisma.listItem.update({
    where: { id: itemId },
    data: { done: false, position: await nextPosition(listId) },
  });
}

/**
 * Puts a ticked item back on the list, used when one is picked from the suggestions
 * under the add box.
 */
export async function restoreListItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await restore(item.id, item.listId);
  revalidatePath(`/lists/${item.listId}`);
}

/**
 * Writes a new running order after a drag.
 *
 * Only ids that genuinely belong to this list are touched, so a request naming
 * somebody else's item reorders nothing. Positions are rewritten in one transaction,
 * because a half-applied order is worse than the one it replaced.
 */
export async function reorderListItems(formData: FormData) {
  const list = await listInScope(String(formData.get("listId")));

  const requested = String(formData.get("itemIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (requested.length === 0) return;

  const owned = new Set(
    (
      await prisma.listItem.findMany({
        where: { listId: list.id, id: { in: requested } },
        select: { id: true },
      })
    ).map((item) => item.id),
  );

  const ordered = requested.filter((id) => owned.has(id));
  if (ordered.length === 0) return;

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.listItem.update({ where: { id, listId: list.id }, data: { position: index + 1 } }),
    ),
  );

  revalidatePath(`/lists/${list.id}`);
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
