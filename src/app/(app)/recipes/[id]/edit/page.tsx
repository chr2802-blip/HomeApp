import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { updateRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { RecipeForm } from "@/components/recipe-form";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

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
      <PageHeader title="Edit recipe" />
      <RecipeForm
        action={updateRecipe}
        recipe={{ ...recipe, categoryIds: recipe.categories.map((filed) => filed.categoryId) }}
        categories={categories}
        submitLabel="Save changes"
      />
    </>
  );
}
