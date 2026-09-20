"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { readForm, requiredText } from "@/lib/form";
import { pantryKey } from "@/lib/pantry";
import { fail, ok, type ActionResult } from "@/lib/action-result";

/**
 * The household's basic goods: adding one, renaming it, saying it has run out, and
 * dropping it.
 *
 * Not administration, and deliberately not behind the admin check the recipe-category
 * actions make. Which household runs out of rice on a Tuesday is not a question about
 * who runs the household — it is the same everyday business as ticking something off a
 * shopping list, and an app that asked an admin to come and untick the rice would be an
 * app whose pantry is out of date by Thursday. The home is taken from the session and
 * every query goes through `homeDb`, so what these reach is the home on screen and
 * nothing else.
 */

const pantrySchema = z.object({ name: requiredText("Write what you keep in.") });

/** The entry being acted on, found through the caller's own home or not at all. */
async function itemInScope(id: string) {
  const user = await requireHomeUser();
  return homeDb(user.homeId).pantryItem.findUnique({ where: { id } });
}

/**
 * What the pantry page and the meal planner both read.
 *
 * `/meals` is on this list because an in-stock basic good is left out of the ranking
 * behind its suggestions, the same as a staple — see `weekSuggestions`. The shopping
 * lists are not: nothing already on one changes when the cupboard does, and the pantry
 * is read afresh by the press that adds a recipe.
 */
function refreshPantryViews() {
  revalidatePath("/pantry");
  revalidatePath("/meals");
}

/** Postgres refusing the (homeId, key) unique index, said in words a person can act on. */
function duplicate(error: unknown, name: string) {
  const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  if (!clash) throw error;
  return fail(`“${name}” is already in the pantry.`);
}

/**
 * Reads the name, and the key the shopping list will match it by.
 *
 * A name with no key left in it is refused rather than stored: `pantryKey` strips a
 * leading amount and unit, so "2 dl" normalises to nothing at all, and an entry with an
 * empty key would sit on the page looking like a basic good while matching no ingredient
 * line ever written. Worse, it would match the *next* such entry as a duplicate.
 */
function readPantryName(formData: FormData) {
  const form = readForm(pantrySchema, formData);
  if (!form.ok) return form;

  const key = pantryKey(form.fields.name);
  if (!key) return { ok: false, error: "Write what it is called, not how much of it." } as const;

  return { ok: true, fields: { name: form.fields.name, key } } as const;
}

export async function createPantryItem(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireHomeUser();

  const form = readPantryName(formData);
  if (!form.ok) return fail(form.error);

  try {
    // The home is spelled out beside the check that produced it, as createList and
    // createRecipeCategory do: homeDb would stamp it, but its types still ask.
    await prisma.pantryItem.create({
      data: { homeId: user.homeId, name: form.fields.name, key: form.fields.key },
    });
  } catch (error) {
    return duplicate(error, form.fields.name);
  }

  refreshPantryViews();
  return ok();
}

/**
 * Renames an entry — the only thing there is to edit about one, since the other half of
 * what it says is a tick.
 *
 * The key is rewritten from the new name on the way past, never left as it was: an entry
 * renamed from "Salt" to "Sukker" that went on matching salt would be the one failure
 * this whole arrangement is arranged to avoid, and it would be invisible from the page.
 */
export async function renamePantryItem(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const item = await itemInScope(String(formData.get("pantryItemId")));
  if (!item) return fail("That is no longer in the pantry.");

  const form = readPantryName(formData);
  if (!form.ok) return fail(form.error);

  try {
    await prisma.pantryItem.update({
      where: { id: item.id },
      data: { name: form.fields.name, key: form.fields.key },
    });
  } catch (error) {
    return duplicate(error, form.fields.name);
  }

  refreshPantryViews();
  return ok();
}

/**
 * Says whether the household has it, which is the whole of what an entry does.
 *
 * Given the state to land in rather than "the other one", for the reason every queued
 * offline op is: the press that sets it is optimistic, so the same press arriving twice
 * — a double tap, a retry — must leave the cupboard saying what the thumb meant, not
 * flipped back. Acts on one id and reports nothing; there is nothing to refuse.
 */
export async function setPantryStock(formData: FormData) {
  const item = await itemInScope(String(formData.get("pantryItemId")));
  if (!item) return;

  await prisma.pantryItem.update({
    where: { id: item.id },
    data: { inStock: formData.get("inStock") === "true" },
  });

  refreshPantryViews();
}

/**
 * Drops an entry entirely, which is a different thing from having run out: this is the
 * household saying it has stopped treating it as something always in the cupboard. Its
 * lines go back to being ordinary shopping.
 */
export async function deletePantryItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("pantryItemId")));
  if (!item) return;

  await prisma.pantryItem.delete({ where: { id: item.id } });
  refreshPantryViews();
}
