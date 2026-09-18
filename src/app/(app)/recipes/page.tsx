import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { toEmbed } from "@/lib/embed";
import { NewRecipeDialog } from "@/components/new-recipe-dialog";
import { RecipeDirectory, type RecipeSummary } from "@/components/recipe-directory";

export default async function RecipesPage() {
  const user = await requireHomeUser();
  const db = homeDb(user.homeId);

  const [recipes, categories] = await Promise.all([
    // The headings each recipe is filed under come back with it, as ids rather than
    // rows: the page already has every category's name, and the cards only need to
    // know which of them a recipe belongs to.
    db.recipe.findMany({
      orderBy: { createdAt: "desc" },
      include: { categories: { select: { categoryId: true } } },
    }),
    // Alphabetical: the headings are a table of contents, and a household's own order
    // of creation is not one a reader can scan by. Only the two columns the page shows,
    // since these cross to the client.
    db.recipeCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const summaries: RecipeSummary[] = recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    categoryIds: recipe.categories.map((filed) => filed.categoryId),
    photoId: recipe.photoId,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    videoUrl: recipe.videoUrl,
    hasVideo: Boolean(toEmbed(recipe.videoUrl)),
  }));

  return (
    <>
      <PageHeader
        title="Recipes"
        description="Write them out, or just save the reel you want to cook from."
        action={<NewRecipeDialog categories={categories} action={createRecipe} />}
      />

      <RecipeDirectory recipes={summaries} categories={categories} />
    </>
  );
}
