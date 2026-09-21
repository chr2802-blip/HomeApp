"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { homeScoped } from "@/lib/scoped";
import { bodyText, optionalText, readForm, requiredText } from "@/lib/form";
import { safeExternalHref } from "@/lib/embed";
import { discardPhoto, discardReplaced, readPhotoChoice } from "@/lib/photos";
import { readCategoryChoice } from "@/lib/recipes";
import { fail, ok, type ActionResult } from "@/lib/action-result";

const recipeInScope = homeScoped("Recipe", (id) => prisma.recipe.findUnique({ where: { id } }));

const TIME_MESSAGE = "Time must be a whole number of minutes.";

/** Blank means the recipe's time was not given — not a recipe that takes no time. */
const totalTimeMinutes = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : null))
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
    error: TIME_MESSAGE,
  });

const recipeSchema = z.object({
  title: requiredText("Give the recipe a title."),
  description: optionalText,
  ingredients: bodyText,
  instructions: bodyText,
  totalTimeMinutes,
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

const READER_UNAVAILABLE = "Could not prepare these steps just now. Try again in a moment.";

type RecipeText = { title: string; ingredients: string; instructions: string };

/**
 * The reader, fetched only when something is actually going to be read.
 *
 * `cook-steps.ts` pulls in the Anthropic SDK, and this module is imported by four route
 * segments — the recipe list, a recipe, its edit page and the new-recipe page — none of
 * which reads anything until a form is submitted. A static import would put the SDK in
 * all four of their server bundles and pay for loading it on the first request to each.
 */
const reader = async () => (await import("@/lib/cook-steps")).prepareCookSteps;

/**
 * The instructions and the breakdown action mode reads them by, written together.
 *
 * **The invariant this exists to keep: a write that changes `ingredients` or
 * `instructions` also writes `cookSteps`.** The breakdown points at lines by their
 * position, so one left behind by an edit would put another ingredient under a step —
 * at the hob, silently. `lib/cook.ts` guards against that by refusing a mapping whose
 * length has drifted, but the guard is the net; this is the mechanism.
 *
 * So a reader that could not answer clears the column rather than leaving what was there.
 * The recipe still saves, and action mode shows its steps plainly: the feature degrades,
 * the save does not fail. Nothing about a model being down should stand between a cook
 * and writing down a recipe.
 */
async function withCookSteps(fields: RecipeText, homeId: string) {
  const read = await (await reader())(fields, homeId);

  return read.ok
    ? { instructions: read.instructions, cookSteps: { v: 1, steps: read.steps } }
    : { instructions: fields.instructions, cookSteps: Prisma.DbNull };
}

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
      ...(await withCookSteps(form.fields, user.homeId)),
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

  // Read again only where the answer could have changed: the text it was derived from, or
  // a recipe that has never had one. A title-only edit costs nothing, and — more to the
  // point — steps left alone are steps that do not drift a little further from the cook's
  // own words on every unrelated save.
  const rewrite =
    form.fields.instructions !== recipe.instructions ||
    form.fields.ingredients !== recipe.ingredients ||
    recipe.cookSteps === null;

  const prepared = rewrite ? await withCookSteps(form.fields, recipe.homeId) : null;

  // The old pairings go before the new ones are written, in one transaction: a heading
  // that was ticked before and still is would otherwise be written twice, and a recipe
  // must not be left half-filed if the second statement fails.
  await prisma.$transaction([
    prisma.recipeCategoryLink.deleteMany({ where: { recipeId: recipe.id } }),
    prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        ...form.fields,
        ...(prepared ?? {}),
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

/**
 * Prepares one recipe for action mode on request, rather than as part of a save.
 *
 * This is how every recipe written before action mode existed gets its breakdown, and how
 * one saved while the reader was down gets a second chance — pressed from inside action
 * mode itself, which is the one place the absence is actually felt. It writes exactly what
 * a save would write, through the same one function, so there is no second idea here about
 * what a prepared recipe is.
 *
 * Unlike a save it refuses out loud: nothing else happened on this press, so a reader that
 * would not answer has to be the answer.
 */
export async function prepareRecipeSteps(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const recipe = await recipeInScope(String(formData.get("recipeId")));

  const read = await (await reader())(recipe, recipe.homeId);
  if (!read.ok) return fail(READER_UNAVAILABLE);

  await prisma.recipe.update({
    where: { id: recipe.id },
    data: { instructions: read.instructions, cookSteps: { v: 1, steps: read.steps } },
  });

  revalidatePath(`/recipes/${recipe.id}`);
  revalidatePath(`/recipes/${recipe.id}/cook`);
  return ok();
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
