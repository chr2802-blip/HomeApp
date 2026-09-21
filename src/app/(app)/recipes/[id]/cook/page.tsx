import { notFound } from "next/navigation";

import { prepareRecipeSteps } from "@/app/actions/recipes";
import { requireHomeUser } from "@/lib/auth";
import { cookSteps, isPrepared } from "@/lib/cook";
import { homeDb } from "@/lib/home-db";
import { ingredientLines } from "@/lib/recipes";
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
export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const recipe = await homeDb(user.homeId).recipe.findUnique({
    where: { id },
    // `photoId` and not the photo: a picture is served from /api/photos, never carried
    // through a page. Nothing here shows one anyway — the dish is what is on the hob.
    select: { id: true, title: true, ingredients: true, instructions: true, cookSteps: true },
  });
  if (!recipe) notFound();

  return (
    <CookMode
      recipeId={recipe.id}
      title={recipe.title}
      steps={cookSteps(recipe)}
      ingredients={ingredientLines(recipe.ingredients)}
      prepared={isPrepared(recipe)}
      prepareAction={prepareRecipeSteps}
    />
  );
}
