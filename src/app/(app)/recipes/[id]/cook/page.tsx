import { notFound } from "next/navigation";

import { prepareRecipeSteps } from "@/app/actions/recipes";
import { requireHomeUser } from "@/lib/auth";
import { cookSteps, isPrepared } from "@/lib/cook";
import { homeDb } from "@/lib/home-db";
import { todayInZone } from "@/lib/time";
import { ingredientLines, PORTIONS_PARAM, portionsShown } from "@/lib/recipes";
import { scaleIngredient } from "@/lib/ingredient-line";
import { CookMode } from "@/components/cook-mode";

/**
 * Preparing a recipe's steps runs as a server action from this page, and it is a model
 * call — the same one a save makes. The platform's default ceiling is shorter than that
 * is allowed to take.
 */
export const maxDuration = 60;

/**
 * Cooking a recipe, one step to a screen.
 *
 * A route rather than a panel on the recipe page, so it has an address: the phone's back
 * gesture leaves it, and a cook who locks the screen mid-dinner comes back to the same
 * place. The page draws nothing itself — the surface is fixed and portalled over the
 * app's own chrome, which is `CookMode`'s to explain.
 */
export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const asked = (await searchParams)[PORTIONS_PARAM];
  const user = await requireHomeUser();

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const db = homeDb(user.homeId);
  const recipe = await db.recipe.findUnique({
    where: { id },
    // `photoId` and not the photo: a picture is served from /api/photos, never carried
    // through a page. Nothing here shows one anyway — the dish is what is on the hob.
    select: { id: true, title: true, ingredients: true, instructions: true, cookSteps: true, servings: true },
  });
  if (!recipe) notFound();

  // What could go on the stove beside it: every recipe by name, and tonight's first
  // because the second dish is usually the one that goes with it. Titles only — a
  // household's recipes are dozens, not thousands, and the picker filters as typed.
  const [recipes, tonight] = await Promise.all([
    db.recipe.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.mealPlan.findUnique({
      where: { homeId_date: { homeId: user.homeId, date: todayInZone() } },
      select: { recipeId: true },
    }),
  ]);

  // The amounts the recipe page was showing when "Start cooking" was pressed. Scaled line
  // by line, so every line keeps its position and the stored breakdown's indices still
  // point at the same ingredients; `isPrepared` is asked of the stored text, not this.
  const portions = portionsShown(recipe.servings, asked);
  const factor = recipe.servings && portions ? portions / recipe.servings : 1;
  const scaled = {
    ...recipe,
    ingredients: ingredientLines(recipe.ingredients)
      .map((line) => scaleIngredient(line, factor, user.homeLanguage))
      .join("\n"),
  };

  return (
    <CookMode
      key={recipe.id}
      recipeId={recipe.id}
      title={recipe.title}
      steps={cookSteps(scaled)}
      ingredients={ingredientLines(scaled.ingredients)}
      portions={portions !== recipe.servings ? portions : null}
      servings={recipe.servings}
      prepared={isPrepared(recipe)}
      prepareAction={prepareRecipeSteps}
      recipes={recipes}
      tonightId={tonight?.recipeId ?? null}
    />
  );
}
