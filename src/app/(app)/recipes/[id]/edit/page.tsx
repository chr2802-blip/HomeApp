import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { updateRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { RecipeForm } from "@/components/recipe-form";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

/**
 * Saving a recipe now reads it as well: the steps are prepared for action mode in the
 * same press, so the cook sees the result of their own Save rather than watching the
 * recipe change under them a moment later. That is one model call inside the action, and
 * the platform's default ceiling is shorter than `PREPARE_TIMEOUT_MS` is allowed to be.
 * It belongs on the segment rather than in `vercel.json`, which is schema-validated and
 * rejects keys it does not know.
 */
export const maxDuration = 60;

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);

  const db = homeDb(user.homeId);

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const [recipe, categories] = await Promise.all([
    db.recipe.findUnique({
      where: { id },
      include: { categories: { select: { categoryId: true } } },
    }),
    db.recipeCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!recipe) notFound();

  return (
    <>
      <PageHeader title={say(RECIPES.editRecipe)} />
      <RecipeForm
        action={updateRecipe}
        recipe={{ ...recipe, categoryIds: recipe.categories.map((filed) => filed.categoryId) }}
        categories={categories}
        submitLabel={say(RECIPES.saveChanges)}
        language={user.homeLanguage}
      />
    </>
  );
}
