import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessHome } from "@/lib/access";
import { updateRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { RecipeForm } from "@/components/recipe-form";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe || !canAccessHome(user, recipe.homeId)) notFound();

  return (
    <>
      <PageHeader title="Edit recipe" />
      <RecipeForm action={updateRecipe} recipe={recipe} submitLabel="Save changes" />
    </>
  );
}
