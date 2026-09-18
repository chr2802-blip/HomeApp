import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import { Badge, Card } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { RecipeFields } from "@/components/recipe-fields";
import { safeExternalHref, toEmbed } from "@/lib/embed";
import { PhotoBanner } from "@/components/photo";
import { AddToListMenu } from "@/components/add-to-list-menu";
import { ingredientLines } from "@/lib/recipes";

/** Instructions are written the same way ingredients are: one step to a line. */
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
  const [recipe, categories, lists] = await Promise.all([
    db.recipe.findUnique({
      where: { id },
      // Alphabetical, like the picker and the headings on the recipes page: the order
      // a recipe's own categories were ticked in means nothing to the next reader.
      include: {
        categories: {
          select: { category: { select: { id: true, name: true } } },
          orderBy: { category: { name: "asc" } },
        },
      },
    }),
    db.recipeCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    /*
     * The home's lists that track amounts, for the "Add to list" menu — an ingredient
     * line is a quantity, and a list that ignores amounts has nowhere to put it.
     * Alphabetical rather than newest first: this is a chooser, and a chooser whose
     * order changes as lists are made is one you have to read every time. Only what is
     * still outstanding is counted — a list of forty ticked-off items is an empty list
     * to anybody shopping.
     */
    db.list.findMany({
      where: { trackAmounts: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true, _count: { select: { items: { where: { done: false } } } } },
    }),
  ]);
  if (!recipe) notFound();

  const embed = toEmbed(recipe.videoUrl);
  const originalHref = safeExternalHref(recipe.videoUrl);
  const ingredients = ingredientLines(recipe.ingredients);
  const instructions = lines(recipe.instructions);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {recipe.categories.map((filed) => (
              <Badge key={filed.category.id}>{filed.category.name}</Badge>
            ))}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight break-words">{recipe.title}</h1>
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
          <RecipeFields
            recipe={{
              ...recipe,
              categoryIds: recipe.categories.map((filed) => filed.category.id),
            }}
            categories={categories}
          />
        </ItemMenu>
      </div>

      {/* Above the video, when there is both: the picture is what the dish should end
          up looking like, and it loads instantly where an embed does not. */}
      <PhotoBanner photoId={recipe.photoId} alt={recipe.title} className="mb-6" />

      {embed && (
        <Card className="mb-6 overflow-hidden p-0">
          <div
            className={`relative mx-auto w-full overflow-hidden ${embed.aspect === "vertical" ? "max-w-sm" : ""}`}
            style={{ aspectRatio: embed.aspect === "vertical" ? "9 / 16" : "16 / 9" }}
          >
            <iframe
              src={embed.src}
              title={recipe.title}
              className="absolute inset-x-0 h-full w-full"
              style={
                embed.crop
                  ? {
                      top: -embed.crop.top,
                      height: `calc(100% + ${embed.crop.top + embed.crop.bottom}px)`,
                    }
                  : { top: 0 }
              }
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
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="mt-2 text-sm font-semibold text-slate-500 uppercase">Ingredients</h2>
            {/* Only where there is something to add. A recipe still being written would
                otherwise offer to put nothing on a list. */}
            {ingredients.length > 0 && (
              <AddToListMenu
                recipeId={recipe.id}
                lists={lists.map((list) => ({
                  id: list.id,
                  title: list.title,
                  open: list._count.items,
                }))}
              />
            )}
          </div>
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
