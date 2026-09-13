import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { updateRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { RecipeForm } from "@/components/recipe-form";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const recipe = await homeDb(user.homeId).recipe.findUnique({ where: { id } });
  if (!recipe) notFound();

  return (
    <>
      <PageHeader title="Edit recipe" />
      <RecipeForm action={updateRecipe} recipe={recipe} submitLabel="Save changes" />
    </>
  );
}
