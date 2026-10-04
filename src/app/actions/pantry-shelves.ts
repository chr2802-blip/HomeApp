"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { canAdministerCurrentHome } from "@/lib/access";
import { homeDb } from "@/lib/home-db";
import { readForm, requiredText } from "@/lib/form";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sayIn, type Say } from "@/lib/copy/say";
import { PANTRY_SHELVES } from "@/lib/copy/pantry";
import { namesBuiltInShelf } from "@/lib/pantry-shelves";

/**
 * The household's own pantry shelves: making one, renaming it, deleting it.
 *
 * Administration, unlike the pantry's own actions beside these. Filing the rice is
 * everybody's; deciding what shelves the cupboard has is setting the household up, and
 * it lives on `/settings` next to the recipe categories for the same reason those do.
 * Gated exactly as they are — the home on screen, asked with `canAdministerCurrentHome`,
 * never `requireAdmin`, which would admit an admin of the flat to the summer house.
 */

function shelfSchema(say: Say) {
  return z.object({ name: requiredText(say(PANTRY_SHELVES.nameRequired)) });
}

async function adminUser() {
  const user = await requireHomeUser();
  if (!canAdministerCurrentHome(user)) redirect("/dashboard");
  return user;
}

/** The shelf being acted on, read through its home, so another home's id finds nothing. */
async function shelfInScope(id: string) {
  const { homeId } = await adminUser();
  return homeDb(homeId).pantryShelf.findUnique({ where: { id } });
}

/**
 * A name that is free in this home: not a built-in shelf's in either language, and not
 * one of the household's own under different capitals. The unique index holds the exact
 * spelling; this is the looser question a person means by "the same shelf".
 */
async function nameTaken(homeId: string, name: string, except?: string) {
  if (namesBuiltInShelf(name)) return true;
  const clash = await homeDb(homeId).pantryShelf.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(except ? { NOT: { id: except } } : {}) },
    select: { id: true },
  });
  return clash !== null;
}

/** Postgres refusing the (homeId, name) unique index — two saves racing past `nameTaken`. */
function duplicate(error: unknown, name: string, say: Say) {
  const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  if (!clash) throw error;
  return fail(say(PANTRY_SHELVES.alreadyExists, { name }));
}

function refreshShelfViews() {
  revalidatePath("/settings");
  revalidatePath("/pantry");
}

export async function createPantryShelf(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await adminUser();
  const say = sayIn(user.homeLanguage);

  const form = readForm(shelfSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);
  const { name } = form.fields;
  if (await nameTaken(user.homeId, name)) return fail(say(PANTRY_SHELVES.alreadyExists, { name }));

  try {
    await prisma.pantryShelf.create({ data: { homeId: user.homeId, name } });
  } catch (error) {
    return duplicate(error, name, say);
  }

  refreshShelfViews();
  return ok();
}

export async function renamePantryShelf(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const shelf = await shelfInScope(String(formData.get("shelfId")));
  if (!shelf) return fail(say(PANTRY_SHELVES.noLongerExists));

  const form = readForm(shelfSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);
  const { name } = form.fields;
  if (await nameTaken(user.homeId, name, shelf.id)) return fail(say(PANTRY_SHELVES.alreadyExists, { name }));

  try {
    await prisma.pantryShelf.update({ where: { id: shelf.id }, data: { name } });
  } catch (error) {
    return duplicate(error, name, say);
  }

  refreshShelfViews();
  return ok();
}

/**
 * Removes a shelf, and sends what was on it back to "not sorted yet" (the foreign key's
 * `SetNull`). Not refused while in use, unlike a recipe category: an unsorted entry is
 * a state the pantry already has and asks about under its own heading, where a recipe
 * under no category would vanish from the page that lists recipes. The confirmation
 * says how many things are moving, so nobody is surprised to find them there.
 */
export async function deletePantryShelf(formData: FormData) {
  const shelf = await shelfInScope(String(formData.get("shelfId")));
  if (!shelf) return;

  await prisma.pantryShelf.delete({ where: { id: shelf.id } });
  refreshShelfViews();
}
