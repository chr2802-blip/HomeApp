import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { RecipeForm } from "@/components/recipe-form";

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
