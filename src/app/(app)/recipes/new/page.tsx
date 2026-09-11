import { requireHomeUser } from "@/lib/auth";
import { createRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { RecipeForm } from "@/components/recipe-form";

export default async function NewRecipePage() {
  await requireHomeUser();

  return (
    <>
      <PageHeader title="New recipe" />
      <RecipeForm action={createRecipe} submitLabel="Save recipe" />
    </>
  );
}
