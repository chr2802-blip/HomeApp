import Link from "next/link";
import { findNewSuggestedRecipe } from "@/app/actions/recipe-suggestion";
import { suggestedRecipeFor } from "@/lib/recipe-suggestion";
import { Card } from "@/components/ui";
import { PhotoCover } from "@/components/photo";
import { SubmitButton } from "@/components/submit-button";

/**
 * Tonight's suggestion, picked once a day and replaceable on demand.
 *
 * Absent entirely rather than an empty card when the home has nothing eligible to
 * suggest — no recipes at all, or every one of them filed under a category an admin
 * excluded — the same reasoning the rest of the dashboard uses for a heading with
 * nothing behind it.
 */
export async function SuggestedRecipe({ homeId }: { homeId: string }) {
  const recipe = await suggestedRecipeFor(homeId);
  if (!recipe) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Tonight&apos;s dinner</h2>
      <Card padded={false} className="overflow-hidden">
        <Link href={`/recipes/${recipe.id}`}>
          <PhotoCover photoId={recipe.photoId} alt="" />
          <div className="p-4">
            <p className="font-medium">{recipe.title}</p>
            {recipe.description && (
              <p className="mt-1 text-sm text-slate-500">{recipe.description}</p>
            )}
          </div>
        </Link>
        <form action={findNewSuggestedRecipe} className="border-t border-slate-100 p-3">
          <SubmitButton variant="secondary" pendingLabel="Finding…" className="w-full">
            Find new
          </SubmitButton>
        </form>
      </Card>
    </section>
  );
}
