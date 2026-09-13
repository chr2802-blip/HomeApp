import Link from "next/link";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createRecipe } from "@/app/actions/recipes";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { toEmbed } from "@/lib/embed";
import { FormDialog } from "@/components/form-dialog";
import { RecipeFields } from "@/components/recipe-fields";

export default async function RecipesPage() {
  const user = await requireHomeUser();

  const recipes = await homeDb(user.homeId).recipe.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Recipes"
        description="Write them out, or just save the reel you want to cook from."
        action={
          <FormDialog
            triggerLabel="New recipe"
            title="New recipe"
            submitLabel="Save recipe"
            action={createRecipe}
          >
            <RecipeFields />
          </FormDialog>
        }
      />

      {recipes.length === 0 ? (
        <EmptyState>No recipes saved yet.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((recipe, index) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              prefetch
              className="pressable animate-row-in block active:scale-[0.98]"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <Card className="h-full transition-colors duration-150 hover:border-slate-400">
                <p className="font-medium">{recipe.title}</p>
                {recipe.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{recipe.description}</p>
                )}
                {toEmbed(recipe.videoUrl) && (
                  <p className="mt-2 text-xs text-slate-500">Includes a video</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
