"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";
import { safeExternalHref } from "@/lib/embed";

async function recipeInScope(recipeId: string) {
  const user = await requireHomeUser();
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) throw new Error("Recipe not found");
  assertHomeAccess(user, recipe.homeId);
  return recipe;
}

function readRecipeForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    ingredients: String(formData.get("ingredients") ?? "").trim(),
    instructions: String(formData.get("instructions") ?? "").trim(),
    videoUrl: safeExternalHref(String(formData.get("videoUrl") ?? "")),
  };
}

export async function createRecipe(formData: FormData) {
  const user = await requireHomeUser();
  const data = readRecipeForm(formData);
  if (!data.title) return;

  const recipe = await prisma.recipe.create({
    data: { ...data, homeId: user.homeId, createdById: user.id },
  });

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(formData: FormData) {
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  const data = readRecipeForm(formData);
  if (!data.title) return;

  await prisma.recipe.update({ where: { id: recipe.id }, data });

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
