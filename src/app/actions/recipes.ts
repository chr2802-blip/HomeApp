"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";
import { safeExternalHref } from "@/lib/embed";
import { fail, invalid, parsed, type ActionResult } from "@/lib/action-result";

async function recipeInScope(recipeId: string) {
  const user = await requireHomeUser();
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) throw new Error("Recipe not found");
  assertHomeAccess(user, recipe.homeId);
  return recipe;
}

type RecipeFieldValues = {
  title: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  videoUrl: string | null;
};

function readRecipeForm(formData: FormData) {
  const rawVideoUrl = String(formData.get("videoUrl") ?? "").trim();
  const videoUrl = safeExternalHref(rawVideoUrl);

  // A link that was typed but could not be understood is a mistake worth reporting,
  // rather than silently dropping what the cook pasted.
  if (rawVideoUrl && !videoUrl) {
    return invalid<RecipeFieldValues>("That video link is not a valid web address.");
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return invalid<RecipeFieldValues>("Give the recipe a title.");

  return parsed<RecipeFieldValues>({
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    ingredients: String(formData.get("ingredients") ?? "").trim(),
    instructions: String(formData.get("instructions") ?? "").trim(),
    videoUrl,
  });
}

export async function createRecipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readRecipeForm(formData);
  if (!form.ok) return fail(form.error);

  const recipe = await prisma.recipe.create({
    data: { ...form.fields, homeId: user.homeId, createdById: user.id },
  });

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  const form = readRecipeForm(formData);
  if (!form.ok) return fail(form.error);

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
