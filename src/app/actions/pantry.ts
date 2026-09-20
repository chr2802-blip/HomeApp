"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { homeScoped } from "@/lib/scoped";
import { readForm, requiredText } from "@/lib/form";
import { addItem } from "@/lib/list-writes";
import { MIN_AMOUNT } from "@/lib/amount";
import { alreadyOnListNote, pantryKey } from "@/lib/pantry";
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

/** The list a restock run writes to, checked the same way every other action checks one. */
const listInScope = homeScoped("List", (id) => prisma.list.findUnique({ where: { id } }));

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
 * what it says is the switch beside it.
 *
 * The key is rewritten from the new name on the way past, never left as it was: an entry
 * renamed from "Salt" to "Sukker" that went on matching salt would be the one failure
 * this whole arrangement is arranged to avoid, and it would be invisible from the page.
 *
 * Like `addRecipeIngredients` it takes the form data alone: it is not submitted by a
 * form but committed by pressing away from the name on the row, so there is no previous
 * state for React to hand it. It still reports — a name the household already keeps
 * something under is refused, and the row has to be able to say why it went back to
 * what it said.
 */
export async function renamePantryItem(formData: FormData): Promise<ActionResult> {
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

/**
 * Puts everything the household has run out of onto one of its lists.
 *
 * The pantry already knows what is missing — that is what the switches are — so asking
 * somebody to type those five lines into the shopping list is asking them to say it
 * twice. This is the press that says it once: the button is where the answer already
 * lives.
 *
 * **Nothing is switched back on.** What has run out has run out until somebody has been
 * to the shop, and a list is a plan rather than a receipt — flipping the cupboard here
 * would have the pantry telling the next recipe that the rice is in because somebody
 * wrote rice down.
 *
 * Each line goes through `addItem`, the same write the add box and the offline queue
 * use, so "already there" means here exactly what it means everywhere else: a ticked row
 * comes back at one, and an open row is left exactly as it is — being out of rice is not
 * a reason to buy two. Row by row rather than in one transaction, unlike a recipe's
 * ingredients: every line here is independent and the run is idempotent, so a press that
 * failed halfway is finished by pressing again, which is a better answer than one that
 * undoes the rows it managed.
 */
export async function addPantryToList(formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const list = await listInScope(String(formData.get("listId")));

  const missing = await homeDb(user.homeId).pantryItem.findMany({
    where: { inStock: false },
    orderBy: { name: "asc" },
  });
  if (missing.length === 0) return fail("Nothing in the pantry has run out.");

  const already: string[] = [];
  let added = 0;

  for (const item of missing) {
    const outcome = await addItem(list.id, item.name, MIN_AMOUNT);
    if (outcome.ok) added += 1;
    else already.push(outcome.clash);
  }

  if (added === 0) return fail("Everything that has run out is already on the list.");

  // The three views a list is read in, refreshed together — the same three
  // `refreshListViews` covers in the list actions, which cannot be shared from a module
  // whose every export has to be a server action.
  revalidatePath(`/lists/${list.id}`);
  revalidatePath("/lists");
  revalidatePath("/dashboard");

  return ok(alreadyOnListNote(already));
}
