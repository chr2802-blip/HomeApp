import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createRecipe } from "@/app/actions/recipes";
import { PageHeader } from "@/components/ui";
import { parseSocialEmbed } from "@/lib/embed";
import { NewRecipeDialog } from "@/components/new-recipe-dialog";
import { RecipeDirectory, type RecipeSummary } from "@/components/recipe-directory";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { isInFormat } from "@/lib/cook";

/**
 * An import runs as a server action from this page, and it is the one thing in this app
 * that does two slow things in a row: a fetch of somebody else's site, and then the read
 * that turns what came back into a recipe. The platform's default ceiling is shorter than
 * the two of them together, and a function killed mid-read looks to the cook exactly like
 * an app that hung. The limits either half is allowed (`FETCH_TIMEOUT_MS` and
 * `NORMALIZE_TIMEOUT_MS`) add up to well under this, so this is a backstop rather than a
 * budget. It belongs on the segment rather than in `vercel.json`, which is schema-validated
 * and rejects keys it does not know.
 */
export const maxDuration = 60;

export default async function RecipesPage() {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
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
    hasVideo: Boolean(parseSocialEmbed(recipe.videoUrl)),
    totalTimeMinutes: recipe.totalTimeMinutes,
    inFormat: isInFormat(recipe.cookSteps),
  }));

  return (
    <>
      <PageHeader
        title={say(RECIPES.title)}
        description={say(RECIPES.description)}
        action={<NewRecipeDialog categories={categories} action={createRecipe} />}
      />

      <RecipeDirectory recipes={summaries} categories={categories} />
    </>
  );
}
