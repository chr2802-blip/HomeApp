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
import { discardPhoto, discardReplaced, readPhotoChoice } from "@/lib/photos";
import { readCategoryChoice } from "@/lib/recipes";
import { fail, type ActionResult } from "@/lib/action-result";

const recipeInScope = homeScoped("Recipe", (id) => prisma.recipe.findUnique({ where: { id } }));

const recipeSchema = z.object({
  title: requiredText("Give the recipe a title."),
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

/** Said the same way whether none was chosen or one that this home cannot see. */
const NO_CATEGORY = "Choose at least one category for this recipe.";

/**
 * The categories this recipe is to be filed under, once they are known to be this
 * home's own — and nothing at all if any of them is not.
 *
 * The picker only offers the home's categories, so a mismatch means either a stale page
 * — a category was deleted while the dialog stood open — or a submission that did not
 * come from the picker at all. Counted through homeDb, so another home's id is simply
 * not found, and a recipe cannot be filed under a heading its household cannot see.
 *
 * The ids are already deduplicated, so matching the count is the same question as
 * matching every id, asked in one query rather than one per heading.
 */
async function chosenCategories(homeId: string, formData: FormData) {
  const categoryIds = readCategoryChoice(formData);
  if (categoryIds.length === 0) return null;

  const known = await homeDb(homeId).recipeCategory.count({
    where: { id: { in: categoryIds } },
  });

  return known === categoryIds.length ? categoryIds : null;
}

/** The pairings a recipe is written with, as a nested create on the recipe itself. */
const filedUnder = (categoryIds: string[]) => categoryIds.map((categoryId) => ({ categoryId }));

export async function createRecipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readForm(recipeSchema, formData);
  if (!form.ok) return fail(form.error);

  const categoryIds = await chosenCategories(user.homeId, formData);
  if (!categoryIds) return fail(NO_CATEGORY);

  const photo = await readPhotoChoice(formData, user.homeId);
  if (!photo.ok) return fail(photo.error);

  const recipe = await prisma.recipe.create({
    data: {
      ...form.fields,
      photoId: photo.photoId ?? null,
      homeId: user.homeId,
      createdById: user.id,
      categories: { create: filedUnder(categoryIds) },
    },
  });

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  const form = readForm(recipeSchema, formData);
  if (!form.ok) return fail(form.error);

  const categoryIds = await chosenCategories(recipe.homeId, formData);
  if (!categoryIds) return fail(NO_CATEGORY);

  const photo = await readPhotoChoice(formData, recipe.homeId);
  if (!photo.ok) return fail(photo.error);

  // The old pairings go before the new ones are written, in one transaction: a heading
  // that was ticked before and still is would otherwise be written twice, and a recipe
  // must not be left half-filed if the second statement fails.
  await prisma.$transaction([
    prisma.recipeCategoryLink.deleteMany({ where: { recipeId: recipe.id } }),
    prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        ...form.fields,
        photoId: photo.photoId,
        categories: { create: filedUnder(categoryIds) },
      },
    }),
  ]);

  // Only once the row no longer points at it, so a failed update cannot leave a recipe
  // holding a picture that has already gone.
  await discardReplaced(recipe.homeId, recipe.photoId, photo.photoId);

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipe.id}`);
  redirect(`/recipes/${recipe.id}`);
}

export async function deleteRecipe(formData: FormData) {
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  await prisma.recipe.delete({ where: { id: recipe.id } });
  // Nothing else can be pointing at it: a picture belongs to the one thing it was
  // added to.
  await discardPhoto(recipe.homeId, recipe.photoId);
  revalidatePath("/recipes");
  redirect("/recipes");
}
