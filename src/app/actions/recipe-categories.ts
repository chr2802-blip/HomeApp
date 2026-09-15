"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { readForm, requiredText } from "@/lib/form";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const categorySchema = z.object({ name: requiredText("Give the category a name.") });

/**
 * The home whose categories the caller may maintain.
 *
 * Taken from the session rather than the form, unlike `updateHome` — there is no home
 * id to cross-check because the form never sends one, which is one fewer thing to get
 * wrong. `requireAdmin` turns a plain member away before this returns.
 */
async function adminHomeId() {
  await requireAdmin();
  return (await requireHomeUser()).homeId;
}

/**
 * The category being acted on, read through its home.
 *
 * Going through homeDb is what makes another home's category id find nothing at all —
 * the same answer as a category that never existed, which is the point.
 */
async function categoryInScope(id: string) {
  const homeId = await adminHomeId();
  return homeDb(homeId).recipeCategory.findUnique({ where: { id } });
}

/** Postgres refusing the (homeId, name) unique index, said in words a person can act on. */
function duplicate(error: unknown, name: string) {
  const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  if (!clash) throw error;
  return fail(`There is already a category called “${name}”.`);
}

export async function createRecipeCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const homeId = await adminHomeId();

  const form = readForm(categorySchema, formData);
  if (!form.ok) return fail(form.error);

  try {
    // Written through plain prisma with the home spelled out, as createList and
    // createRecipe do: homeDb stamps the home on a create, but its types still ask for
    // the column, and an explicit id beside an explicit check reads plainly.
    await prisma.recipeCategory.create({ data: { homeId, name: form.fields.name } });
  } catch (error) {
    return duplicate(error, form.fields.name);
  }

  revalidatePath("/admin");
  revalidatePath("/recipes");
  return ok();
}

export async function renameRecipeCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const category = await categoryInScope(String(formData.get("categoryId")));
  if (!category) return fail("That category no longer exists.");

  const form = readForm(categorySchema, formData);
  if (!form.ok) return fail(form.error);

  try {
    await prisma.recipeCategory.update({
      where: { id: category.id },
      data: { name: form.fields.name },
    });
  } catch (error) {
    return duplicate(error, form.fields.name);
  }

  revalidatePath("/admin");
  revalidatePath("/recipes");
  return ok();
}

/**
 * Removes a category, but only while nothing is filed under it.
 *
 * Every recipe must be filed under at least one heading, and a recipe filed only under
 * this one would be left under none: it would then be saved but absent from the page
 * that lists the household's recipes. Emptying the heading first is a decision for
 * whoever knows where those recipes belong instead. The admin page offers no Delete for
 * a category in use — this is the check behind that, and the foreign key refuses it as
 * well if both are somehow got past.
 */
export async function deleteRecipeCategory(formData: FormData) {
  const category = await categoryInScope(String(formData.get("categoryId")));
  if (!category) return;

  const inUse = await prisma.recipeCategoryLink.count({ where: { categoryId: category.id } });
  if (inUse > 0) return;

  await prisma.recipeCategory.delete({ where: { id: category.id } });
  revalidatePath("/admin");
  revalidatePath("/recipes");
}
