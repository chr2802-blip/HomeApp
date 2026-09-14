"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";
import { homeScoped } from "@/lib/scoped";
import { readForm, requiredText } from "@/lib/form";
import { clampAmount } from "@/lib/amount";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const listInScope = homeScoped("List", (id) => prisma.list.findUnique({ where: { id } }));

/** An absent amount means one, which is what a list that ignores them always sends. */
const amount = z
  .string()
  .optional()
  .transform((value) => clampAmount(value ?? 1));

/** An unticked checkbox is absent from the form rather than present and false. */
const checkbox = z
  .string()
  .optional()
  .transform((value) => value !== undefined);

const listSchema = z.object({
  title: requiredText("Give the list a name."),
  trackAmounts: checkbox,
});
const itemSchema = z.object({ text: requiredText("Write something to add."), amount });

export async function createList(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readForm(listSchema, formData);
  if (!form.ok) return fail(form.error);

  const list = await prisma.list.create({
    data: {
      title: form.fields.title,
      trackAmounts: form.fields.trackAmounts,
      homeId: user.homeId,
      createdById: user.id,
    },
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

export async function updateList(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const list = await listInScope(String(formData.get("listId")));
  const form = readForm(listSchema, formData);
  if (!form.ok) return fail(form.error);

  await prisma.list.update({
    where: { id: list.id },
    data: { title: form.fields.title, trackAmounts: form.fields.trackAmounts },
  });

  revalidatePath(`/lists/${list.id}`);
  revalidatePath("/lists");
  return ok();
}

/**
 * Stars or unstars a list for whoever is looking at it.
 *
 * Favourites are personal, so the row is keyed by the caller's own id — never by an id
 * the form supplied. Like toggling an item this acts on one id and reports nothing.
 */
export async function toggleListFavorite(formData: FormData) {
  const user = await requireHomeUser();
  const list = await listInScope(String(formData.get("listId")));
  const key = { userId_listId: { userId: user.id, listId: list.id } };

  const starred = await prisma.listFavorite.findUnique({ where: key });
  if (starred) {
    await prisma.listFavorite.delete({ where: key });
  } else {
    await prisma.listFavorite.create({ data: { userId: user.id, listId: list.id } });
  }

  revalidatePath("/dashboard");
  revalidatePath("/lists");
  revalidatePath(`/lists/${list.id}`);
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

  const { text, amount } = form.fields;
  const existing = await prisma.listItem.findFirst({
    where: { listId: list.id, text: { equals: text, mode: "insensitive" } },
    orderBy: { done: "desc" },
  });

  if (existing?.done) {
    await restore(existing.id, list.id, amount);
    revalidatePath(`/lists/${list.id}`);
    return ok();
  }

  if (existing) return fail(`"${existing.text}" is already on the list.`);

  await prisma.listItem.create({
    data: { listId: list.id, text, amount, position: await nextPosition(list.id) },
  });

  revalidatePath(`/lists/${list.id}`);
  return ok();
}

/**
 * Unticks an item and moves it to the end of what is still outstanding, with however
 * many of it are wanted this time rather than last time.
 */
async function restore(itemId: string, listId: string, amount: number) {
  await prisma.listItem.update({
    where: { id: itemId },
    data: { done: false, amount, position: await nextPosition(listId) },
  });
}

/**
 * Puts a ticked item back on the list, used when one is picked from the suggestions
 * under the add box. The amount standing in the add box comes with it.
 */
export async function restoreListItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await restore(item.id, item.listId, clampAmount(formData.get("amount") ?? 1));
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

/**
 * Sets how many of an item are wanted. Like toggling and deleting it acts on one id and
 * reports nothing: the picker can only offer amounts that are already in range, so
 * there is no rejection for a form to show.
 */
export async function setListItemAmount(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await prisma.listItem.update({
    where: { id: item.id },
    data: { amount: clampAmount(formData.get("amount")) },
  });
  revalidatePath(`/lists/${item.listId}`);
}
