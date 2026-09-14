"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { homeScoped } from "@/lib/scoped";
import { optionalText, readForm, requiredText } from "@/lib/form";
import { safeExternalHref } from "@/lib/embed";
import { fail, type ActionResult } from "@/lib/action-result";

const recipeInScope = homeScoped("Recipe", (id) => prisma.recipe.findUnique({ where: { id } }));

const recipeSchema = z.object({
  title: requiredText("Give the recipe a title."),
  categoryId: requiredText("Choose a category for this recipe."),
  description: optionalText,
  ingredients: z.string().trim().optional().transform((value) => value ?? ""),
  instructions: z.string().trim().optional().transform((value) => value ?? ""),
  // A link that was typed but cannot be understood is a mistake worth reporting,
  // rather than silently dropping what the cook pasted. Checked before the transform,
  // which would otherwise make an empty field and a bad link both look like null.
  videoUrl: z
    .string()
    .trim()
    .optional()
    .superRefine((raw, context) => {
      if (raw && !safeExternalHref(raw)) {
        context.addIssue({
          code: "custom",
          message: "That video link is not a valid web address.",
        });
      }
    })
    .transform((raw) => (raw ? safeExternalHref(raw) : null)),
});

/**
 * Checks the chosen category is one of this home's own.
 *
 * The picker only offers the home's categories, so a mismatch means either a stale page
 * — the category was deleted while the dialog stood open — or a submission that did not
 * come from the picker at all. Read through homeDb, so another home's id is simply not
 * found, and the recipe cannot be filed under a heading its household cannot see.
 */
async function categoryInHome(homeId: string, categoryId: string) {
  return homeDb(homeId).recipeCategory.findUnique({ where: { id: categoryId } });
}

export async function createRecipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readForm(recipeSchema, formData);
  if (!form.ok) return fail(form.error);

  if (!(await categoryInHome(user.homeId, form.fields.categoryId))) {
    return fail("Choose a category for this recipe.");
  }

  const recipe = await prisma.recipe.create({
    data: { ...form.fields, homeId: user.homeId, createdById: user.id },
  });

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  const form = readForm(recipeSchema, formData);
  if (!form.ok) return fail(form.error);

  if (!(await categoryInHome(recipe.homeId, form.fields.categoryId))) {
    return fail("Choose a category for this recipe.");
  }

  await prisma.recipe.update({ where: { id: recipe.id }, data: form.fields });

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipe.id}`);
  redirect(`/recipes/${recipe.id}`);
}

export async function deleteRecipe(formData: FormData) {
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  await prisma.recipe.delete({ where: { id: recipe.id } });
  revalidatePath("/recipes");
  redirect("/recipes");
}
