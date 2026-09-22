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
import { RECIPES } from "@/lib/copy/recipes";

/** An unticked checkbox is absent from the form rather than present and false. */
const checkbox = z
  .string()
  .optional()
  .transform((value) => value !== undefined);

function categorySchema(say: Say) {
  return z.object({
    name: requiredText(say(RECIPES.categoryNameRequired)),
    excludeFromSuggestion: checkbox,
  });
}

/**
 * The home whose categories the caller may maintain.
 *
 * Taken from the session rather than the form, unlike `updateHome` — there is no home
 * id to cross-check because the form never sends one, which is one fewer thing to get
 * wrong.
 *
 * Asked of the home on screen, and not of the person. `requireAdmin` answers "do they
 * run *a* home", which is a different question wearing the same clothes: somebody who
 * runs the flat and merely lives in the summer house passes it, and these actions then
 * act on whichever home they have open. Running one household is no licence over the
 * next, so the home being administered is the one that has to be theirs to run — the
 * same check `/settings` makes before drawing the page these forms live on.
 */
async function adminUser() {
  const user = await requireHomeUser();
  if (!canAdministerCurrentHome(user)) redirect("/dashboard");
  return user;
}

/**
 * The category being acted on, read through its home.
 *
 * Going through homeDb is what makes another home's category id find nothing at all —
 * the same answer as a category that never existed, which is the point.
 */
async function categoryInScope(id: string) {
  const { homeId } = await adminUser();
  return homeDb(homeId).recipeCategory.findUnique({ where: { id } });
}

/** Postgres refusing the (homeId, name) unique index, said in words a person can act on. */
function duplicate(error: unknown, name: string, say: Say) {
  const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  if (!clash) throw error;
  return fail(say(RECIPES.categoryAlreadyExists, { name }));
}

export async function createRecipeCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await adminUser();
  const say = sayIn(user.homeLanguage);

  const form = readForm(categorySchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  try {
    // Written through plain prisma with the home spelled out, as createList and
    // createRecipe do: homeDb stamps the home on a create, but its types still ask for
    // the column, and an explicit id beside an explicit check reads plainly.
    await prisma.recipeCategory.create({
      data: {
        homeId: user.homeId,
        name: form.fields.name,
        excludeFromSuggestion: form.fields.excludeFromSuggestion,
      },
    });
  } catch (error) {
    return duplicate(error, form.fields.name, say);
  }

  revalidatePath("/settings");
  revalidatePath("/recipes");
  return ok();
}

export async function renameRecipeCategory(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const category = await categoryInScope(String(formData.get("categoryId")));
  if (!category) return fail(say(RECIPES.categoryNoLongerExists));

  const form = readForm(categorySchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  try {
    await prisma.recipeCategory.update({
      where: { id: category.id },
      data: { name: form.fields.name, excludeFromSuggestion: form.fields.excludeFromSuggestion },
    });
  } catch (error) {
    return duplicate(error, form.fields.name, say);
  }

  revalidatePath("/settings");
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
  revalidatePath("/settings");
  revalidatePath("/recipes");
}
