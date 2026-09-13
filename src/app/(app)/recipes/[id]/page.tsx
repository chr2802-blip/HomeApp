import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import { Card } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { RecipeFields } from "@/components/recipe-fields";
import { safeExternalHref, toEmbed } from "@/lib/embed";

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const recipe = await homeDb(user.homeId).recipe.findUnique({ where: { id } });
  if (!recipe) notFound();

  const embed = toEmbed(recipe.videoUrl);
  const originalHref = safeExternalHref(recipe.videoUrl);
  const ingredients = lines(recipe.ingredients);
  const instructions = lines(recipe.instructions);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
          {recipe.description && <p className="mt-1 text-sm text-slate-500">{recipe.description}</p>}
        </div>
        <div className="flex gap-2">
          <FormDialog
            triggerLabel="Edit"
            triggerVariant="secondary"
            triggerIcon="pencil"
            title="Edit recipe"
            submitLabel="Save changes"
            action={updateRecipe}
          >
            <input type="hidden" name="recipeId" value={recipe.id} />
            <RecipeFields recipe={recipe} />
          </FormDialog>
          <form action={deleteRecipe}>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <ConfirmButton message={`Delete the recipe "${recipe.title}"?`}>Delete</ConfirmButton>
          </form>
        </div>
      </div>

      {embed && (
        <Card className="mb-6 overflow-hidden p-0">
          <div
            className={`relative mx-auto w-full ${embed.aspect === "vertical" ? "max-w-sm" : ""}`}
            style={{ aspectRatio: embed.aspect === "vertical" ? "9 / 16" : "16 / 9" }}
          >
            <iframe
              src={embed.src}
              title={recipe.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            />
          </div>
        </Card>
      )}

      {!embed && originalHref && (
        <Card className="mb-6">
          <a
            href={originalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-900 underline"
          >
            Open the linked video
          </a>
          <p className="mt-1 text-xs text-slate-500">
            This link can&apos;t be embedded, so it opens in a new tab.
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Ingredients</h2>
          {ingredients.length === 0 ? (
            <p className="text-sm text-slate-500">None listed.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {ingredients.map((item, index) => (
                <li key={index} className="flex gap-2">
                  <span className="text-slate-400">·</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Instructions</h2>
          {instructions.length === 0 ? (
            <p className="text-sm text-slate-500">None written — follow the video.</p>
          ) : (
            <ol className="space-y-2.5 text-sm">
              {instructions.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
