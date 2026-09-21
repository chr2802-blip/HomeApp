import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { RecipeForm } from "@/components/recipe-form";

/**
 * Saving a recipe now reads it as well: the steps are prepared for action mode in the
 * same press, so the cook sees the result of their own Save rather than watching the
 * recipe change under them a moment later. That is one model call inside the action, and
 * the platform's default ceiling is shorter than `PREPARE_TIMEOUT_MS` is allowed to be.
 * It belongs on the segment rather than in `vercel.json`, which is schema-validated and
 * rejects keys it does not know.
 */
export const maxDuration = 60;

export default async function NewRecipePage() {
  const user = await requireHomeUser();

  const categories = await homeDb(user.homeId).recipeCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader title="New recipe" />
      <RecipeForm action={createRecipe} categories={categories} submitLabel="Save recipe" />
    </>
  );
}
