"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type HomeLanguage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, type RateLimitResult } from "@/lib/rate-limit";
import { homeDb } from "@/lib/home-db";
import { homeScoped } from "@/lib/scoped";
import { assertHomeAdmin } from "@/lib/access";
import { bodyText, optionalText, readForm, requiredText } from "@/lib/form";
import { safeExternalHref } from "@/lib/embed";
import { discardPhoto, discardReplaced, readPhotoChoice } from "@/lib/photos";
import {
  ingredientLines,
  instructionLines,
  MAX_SERVINGS,
  READING_FIELD,
  readCategoryChoice,
  RECIPE_IDS_FIELD,
  STAY_FIELD,
  STEP_FIELD,
  STEP_MINUTES_FIELD,
  STEP_TEXT_FIELD,
  STEP_USES_FIELD,
} from "@/lib/recipes";
import { editStep, IN_FORMAT, isInFormat, MAX_STEP_MINUTES, readingStands } from "@/lib/cook";
import { readingFor } from "@/lib/reading-token";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sayIn, type Say } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { readHearts } from "@/lib/rating";

const recipeInScope = homeScoped("Recipe", (id) => prisma.recipe.findUnique({ where: { id } }));

/** Create and edit take the same fields. */
function recipeSchema(say: Say) {
  const timeMessage = say(RECIPES.timeMessage);

  /** Blank means the recipe's time was not given — not a recipe that takes no time. */
  const totalTimeMinutes = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
      error: timeMessage,
    });

  /** Blank is a recipe nobody has said the servings of: it still scales by the
   *  multiplier, and simply says no number of people beside it. Optional in the form. */
  const servings = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= MAX_SERVINGS), {
      error: say(RECIPES.servingsMessage),
    });

  return z.object({
    title: requiredText(say(RECIPES.titleRequired)),
    description: optionalText,
    ingredients: bodyText,
    instructions: bodyText,
    totalTimeMinutes,
    servings,
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
            message: say(RECIPES.invalidVideoLink),
          });
        }
      })
      .transform((raw) => (raw ? safeExternalHref(raw) : null)),
  });
}

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

/**
 * Another recipe in this home already called `title`, ignoring case and the spaces round
 * it — "Lasagne" and "lasagne " are the same dish twice. `except` is the recipe being
 * edited, which may of course keep its own name.
 */
async function titleTaken(homeId: string, title: string, except?: string) {
  const clash = await homeDb(homeId).recipe.findFirst({
    where: {
      title: { equals: title.trim(), mode: "insensitive" },
      ...(except ? { id: { not: except } } : {}),
    },
    select: { title: true },
  });
  return clash?.title ?? null;
}

/** The pairings a recipe is written with, as a nested create on the recipe itself. */
const filedUnder = (categoryIds: string[]) => categoryIds.map((categoryId) => ({ categoryId }));

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
 * What a save stores for the recipe's text: its ingredient lines and steps read into the
 * one shape every recipe in the app is kept in (`ingredient-line.ts`), and the breakdown
 * action mode reads them by, all written together.
 *
 * **Every save goes through this**, typed by hand or pre-filled by an import, so there is
 * one way a stored ingredient line looks however the recipe arrived. Whatever a line loses
 * — a cut, a temperature, "efter smag" — the reader moves into the steps, which is why the
 * two are rewritten at once and never one without the other.
 *
 * **The invariant this also keeps: a write that changes `ingredients` or `instructions`
 * also writes `cookSteps`.** The breakdown points at lines by their position, so one left
 * behind by an edit would put another ingredient under a step — at the hob, silently.
 * `lib/cook.ts` guards against that by refusing a mapping whose length has drifted, but the
 * guard is the net; this is the mechanism.
 *
 * So a reader that could not answer stores the recipe exactly as it was written and clears
 * the column rather than leaving what was there. The feature degrades, the save does not
 * fail: nothing about a model being down should stand between a cook and writing down a
 * recipe, and the next save while it is up tidies the recipe then.
 */
async function readForSaving(
  fields: RecipeText,
  homeId: string,
  userId: string,
  language: HomeLanguage,
): Promise<Partial<RecipeText> & { cookSteps: Prisma.InputJsonValue | typeof Prisma.DbNull }> {
  const asWritten = { cookSteps: Prisma.DbNull };
  // Counted only where there is something to read: a recipe with neither ingredients nor
  // steps is answered without the model, and should neither spend an attempt nor be
  // refused one.
  const anything = ingredientLines(fields.ingredients).length || instructionLines(fields.instructions).length;
  if (anything && !(await takeReading(userId)).allowed) {
    // Logged, because the cook is not told: the save goes through as written, and a
    // recipe that quietly never got its breakdown looks like the reader being down.
    console.warn(JSON.stringify({ level: "warn", event: "cook_steps_rate_limited", at: new Date().toISOString() }));
    return asWritten;
  }

  const read = await (await reader())(fields, homeId, language);
  if (!read.ok) return asWritten;

  return {
    title: read.title,
    ingredients: read.ingredients,
    instructions: read.instructions,
    cookSteps: { v: IN_FORMAT, steps: read.steps },
  };
}

/**
 * The language of the home a recipe is filed under, which is what it is read into — not
 * necessarily the one on screen, since a recipe can be edited from a home somebody is not
 * reading right now.
 */
async function languageOf(homeId: string, user: { homeId: string | null; homeLanguage: HomeLanguage }) {
  if (homeId === user.homeId) return user.homeLanguage;
  const home = await prisma.home.findUnique({ where: { id: homeId }, select: { language: true } });
  return home?.language ?? user.homeLanguage;
}

/**
 * A new recipe's reading: the import's own, where the form carries one that still vouches
 * for the text being saved (`reading-token.ts`), and a fresh one otherwise.
 *
 * An import saved untouched is the commonest way a recipe arrives, and the importer has
 * already answered everything the save would ask — the lines in the one format, the steps,
 * the breakdown — under the same rules. Asking again spends a paid call and up to half a
 * minute behind the Save button to get the same answer back. The moment a line is edited
 * the token no longer matches and the save reads it as it would anything typed by hand.
 */
async function readForCreating(
  fields: RecipeText,
  formData: FormData,
  homeId: string,
  userId: string,
  language: HomeLanguage,
) {
  const imported = readingFor(formData.get(READING_FIELD), homeId, fields);
  if (imported) return { cookSteps: { v: IN_FORMAT, steps: imported } };
  return readForSaving(fields, homeId, userId, language);
}

/**
 * One call to the reader, counted against the person asking — the importer's limiter
 * pointed at the other two ways into a paid model call, a save and the "prepare" button.
 *
 * Counted per attempt rather than per failure, as the importer's is: it is the spending
 * being bounded. A save over the limit still saves; it just does what a save does while
 * the reader is down, which is store the recipe and clear its breakdown. Nothing about a
 * limit on the model should stand between a cook and writing a recipe down.
 */
async function takeReading(userId: string): Promise<RateLimitResult> {
  const limit = await checkRateLimit("prepare", userId);
  if (limit.allowed) await recordFailedAttempt("prepare", userId);
  return limit;
}

export async function createRecipe(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const form = readForm(recipeSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  const categoryIds = await chosenCategories(user.homeId, formData);
  if (!categoryIds) return fail(say(RECIPES.chooseCategory));

  // Asked before the reader, so a recipe the household already has spends no model call.
  const taken = await titleTaken(user.homeId, form.fields.title);
  if (taken) return fail(say(RECIPES.duplicateTitle, { title: taken }));

  const photo = await readPhotoChoice(formData, user.homeId, user.homeLanguage);
  if (!photo.ok) return fail(photo.error);

  const read = await readForCreating(form.fields, formData, user.homeId, user.id, user.homeLanguage);
  // And again after it: the reader may have renamed it — translated into the home's
  // language — onto the title of one the household already keeps.
  const readTitle = "title" in read ? read.title : undefined;
  const takenAfter = readTitle && (await titleTaken(user.homeId, readTitle));
  if (takenAfter) return fail(say(RECIPES.duplicateTitle, { title: takenAfter }));

  const recipe = await prisma.recipe.create({
    data: {
      ...form.fields,
      ...read,
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
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  const form = readForm(recipeSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);

  const categoryIds = await chosenCategories(recipe.homeId, formData);
  if (!categoryIds) return fail(say(RECIPES.chooseCategory));

  const taken = await titleTaken(recipe.homeId, form.fields.title, recipe.id);
  if (taken) return fail(say(RECIPES.duplicateTitle, { title: taken }));

  const photo = await readPhotoChoice(formData, recipe.homeId, user.homeLanguage);
  if (!photo.ok) return fail(photo.error);

  // Read wherever the answer could differ from what is stored: the ingredients or the
  // steps changed, or the recipe was never read into the one format — which is how a
  // recipe stored before it existed is brought in: edit anything and save. A title, a
  // picture or a category changed on a recipe already in the format costs no reading.
  // `readingStands` is the one rule, and the form's AI wait asks it too (`needsReading`).
  const untouched = readingStands(form.fields, { ...recipe, inFormat: isInFormat(recipe.cookSteps) });
  const read = untouched
    ? {}
    : await readForSaving(form.fields, recipe.homeId, user.id, await languageOf(recipe.homeId, user));

  // The old pairings go before the new ones are written, in one transaction: a heading
  // that was ticked before and still is would otherwise be written twice, and a recipe
  // must not be left half-filed if the second statement fails.
  await prisma.$transaction([
    prisma.recipeCategoryLink.deleteMany({ where: { recipeId: recipe.id } }),
    prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        ...form.fields,
        ...read,
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
  // Edited from the recipe list, the sheet closes over the list where it was opened —
  // a redirect would land on the recipe and lose the household's place in the list.
  if (formData.get(STAY_FIELD) === "1") return ok();
  redirect(`/recipes/${recipe.id}`);
}

/**
 * Prepares one recipe for action mode on request, rather than as part of a save — which
 * also brings its ingredient lines into the one format, exactly as a save would.
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
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const recipe = await recipeInScope(String(formData.get("recipeId")));

  const limit = await takeReading(user.id);
  if (!limit.allowed) return fail(say(RECIPES.prepareRateLimited, { minutes: limit.retryAfterMinutes }));

  const read = await (await reader())(recipe, recipe.homeId, await languageOf(recipe.homeId, user));
  if (!read.ok) {
    return fail(say(read.reason === "over-limit" ? RECIPES.prepareOverLimit : RECIPES.prepareReaderUnavailable));
  }

  await prisma.recipe.update({
    where: { id: recipe.id },
    data: {
      title: read.title,
      ingredients: read.ingredients,
      instructions: read.instructions,
      cookSteps: { v: IN_FORMAT, steps: read.steps },
    },
  });

  revalidatePath(`/recipes/${recipe.id}`);
  revalidatePath(`/recipes/${recipe.id}/cook`);
  return ok();
}

/**
 * One step of a recipe corrected by hand, from action mode — its text, which ingredients
 * it uses, and its timer — for when the reader got a step wrong and reading the whole
 * recipe again would not be the fix.
 *
 * No model call: the line and its breakdown entry are written together by `editStep`, so
 * the breakdown still lines up with the steps, and the recipe keeps whatever version its
 * breakdown had (the ingredient lines were not touched). Anybody in the home may, as they
 * may edit the recipe itself.
 */
export async function editCookStep(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const recipe = await recipeInScope(String(formData.get("recipeId")));

  const text = String(formData.get(STEP_TEXT_FIELD) ?? "");
  if (!text.trim()) return fail(say(RECIPES.stepTextRequired));

  const rawMinutes = String(formData.get(STEP_MINUTES_FIELD) ?? "").trim();
  const minutes = rawMinutes ? Number(rawMinutes) : null;
  if (minutes !== null && !(Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_STEP_MINUTES)) {
    return fail(say(RECIPES.stepMinutesMessage, { max: MAX_STEP_MINUTES }));
  }

  const edited = editStep(recipe, Number(formData.get(STEP_FIELD)), {
    text,
    uses: formData.getAll(STEP_USES_FIELD).map(Number),
    minutes,
  });
  // The step went away underneath the sheet — the recipe was edited elsewhere meanwhile.
  if (!edited) return fail(say(RECIPES.stepGone));

  await prisma.recipe.update({
    where: { id: recipe.id },
    data: { instructions: edited.instructions, cookSteps: edited.cookSteps },
  });

  revalidatePath(`/recipes/${recipe.id}`);
  revalidatePath(`/recipes/${recipe.id}/cook`);
  return ok();
}

/**
 * Files many recipes under one or more headings at once — the recipe list's "Choose",
 * for a household sorting a collection it built up before it had categories for it.
 *
 * It only ever adds: a recipe keeps every heading it already had, so no recipe can be
 * left under none (the one thing a recipe's categories must never be). A pairing already
 * there is skipped rather than refused. Every recipe and every heading is checked through
 * `homeDb`, and a single one that is not this home's refuses the whole press — a stale
 * page, or a submission that did not come from the list.
 */
export async function addRecipesToCategories(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);

  const recipeIds = [...new Set(formData.getAll(RECIPE_IDS_FIELD).map(String).filter(Boolean))];
  if (recipeIds.length === 0) return fail(say(RECIPES.bulkChooseRecipes));

  const categoryIds = await chosenCategories(user.homeId, formData);
  if (!categoryIds) return fail(say(RECIPES.chooseCategory));

  const known = await homeDb(user.homeId).recipe.count({ where: { id: { in: recipeIds } } });
  if (known !== recipeIds.length) return fail(say(RECIPES.bulkRecipesGone));

  await prisma.recipeCategoryLink.createMany({
    data: recipeIds.flatMap((recipeId) => categoryIds.map((categoryId) => ({ recipeId, categoryId }))),
    skipDuplicates: true,
  });

  revalidatePath("/recipes");
  for (const id of recipeIds) revalidatePath(`/recipes/${id}`);
  return ok(say(RECIPES.bulkFiled, { count: recipeIds.length }));
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

/**
 * Deletes several recipes chosen on the recipe list, after the sheet asked. Each is found
 * through `homeDb`, so an id from another home is simply not there; each picture goes
 * with its recipe, as `deleteRecipe` does it. Stays on the list rather than redirecting —
 * that is where the household is.
 */
export async function deleteRecipes(formData: FormData) {
  const user = await requireHomeUser();
  const ids = [...new Set(formData.getAll(RECIPE_IDS_FIELD).map(String).filter(Boolean))];
  const db = homeDb(user.homeId);
  const recipes = await db.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, photoId: true } });

  for (const recipe of recipes) {
    await db.recipe.delete({ where: { id: recipe.id } });
    await discardPhoto(user.homeId, recipe.photoId);
  }

  revalidatePath("/recipes");
  revalidatePath("/meals");
  revalidatePath("/dashboard");
}

/**
 * Adds one rating to a recipe, from whoever pressed the hearts.
 *
 * Always a new row, never an update of the person's last one: the same person rates the
 * same dish again after cooking it again, and the average is meant to move with them.
 * Like starring a list it acts on a press and reports nothing — the average redrawn is the
 * answer. A number of hearts the buttons cannot produce is ignored rather than clamped,
 * because it arrived by hand and a guess at what it meant would still count.
 */
export async function rateRecipe(formData: FormData) {
  const user = await requireHomeUser();
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  const hearts = readHearts(formData.get("hearts"));
  if (hearts === null) return;

  await prisma.recipeRating.create({ data: { recipeId: recipe.id, userId: user.id, hearts } });

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipe.id}`);
}

/**
 * Clears every rating a recipe has been given, so its average starts again from nothing —
 * for a dish the household now cooks differently, or one rated by mistake.
 *
 * The home's admins only, and asked of the recipe's own home rather than whichever one
 * is on screen: running one household is no licence over the next. Every row goes,
 * everybody's, because the average is asked of all of them and a reset that kept some
 * would be a reset of nothing anybody can see.
 */
export async function resetRecipeRatings(formData: FormData) {
  const user = await requireHomeUser();
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  assertHomeAdmin(user, recipe.homeId);

  await prisma.recipeRating.deleteMany({ where: { recipeId: recipe.id } });

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipe.id}`);
}
