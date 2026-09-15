import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import { Badge, Card } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { RecipeFields } from "@/components/recipe-fields";
import { safeExternalHref, toEmbed } from "@/lib/embed";
import { PhotoBanner } from "@/components/photo";

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  const db = homeDb(user.homeId);

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const [recipe, categories] = await Promise.all([
    db.recipe.findUnique({ where: { id }, include: { category: true } }),
    db.recipeCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!recipe) notFound();

  const embed = toEmbed(recipe.videoUrl);
  const originalHref = safeExternalHref(recipe.videoUrl);
  const ingredients = lines(recipe.ingredients);
  const instructions = lines(recipe.instructions);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1.5">
            <Badge>{recipe.category.name}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{recipe.title}</h1>
          {recipe.description && <p className="mt-1 text-sm text-slate-500">{recipe.description}</p>}
        </div>
        <ItemMenu
          name="recipeId"
          id={recipe.id}
          label={recipe.title}
          editTitle="Edit recipe"
          editAction={updateRecipe}
          deleteAction={deleteRecipe}
          deleteMessage={`Delete the recipe "${recipe.title}"?`}
          className="-mr-2"
        >
          <RecipeFields recipe={recipe} categories={categories} />
        </ItemMenu>
      </div>

      {/* Above the video, when there is both: the picture is what the dish should end
          up looking like, and it loads instantly where an embed does not. */}
      <PhotoBanner photoId={recipe.photoId} alt={recipe.title} className="mb-6" />

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
