import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import { addRecipeIngredients } from "@/app/actions/lists";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { AddToMealPlanMenuItem } from "@/components/add-to-meal-plan-menu-item";
import { recipeSaveOverlay, RecipeFields } from "@/components/recipe-fields";
import { PhotoBanner } from "@/components/photo";
import { safeExternalHref } from "@/lib/embed";
import { AddToListMenu } from "@/components/add-to-list-menu";
import { ScreenAwakeToggle } from "@/components/screen-awake-toggle";
import { ingredientLines, instructionLines, timeLabel } from "@/lib/recipes";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { isInFormat } from "@/lib/cook";

/**
 * Editing a recipe runs as a server action from this page, and saving one now reads its
 * steps for action mode in the same press. The platform's default ceiling is shorter
 * than that is allowed to take.
 */
export const maxDuration = 60;

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);

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

  const ingredients = ingredientLines(recipe.ingredients);
  const instructions = instructionLines(recipe.instructions);
  const videoHref = safeExternalHref(recipe.videoUrl);

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
          {recipe.totalTimeMinutes !== null && (
            <p className="mt-1 text-sm text-slate-500">
              {timeLabel(recipe.totalTimeMinutes, user.homeLanguage)}
            </p>
          )}
          {recipe.description && <p className="mt-1 text-sm text-slate-500">{recipe.description}</p>}
        </div>
        <div className="flex shrink-0 items-start">
          <ScreenAwakeToggle />
          <ItemMenu
            name="recipeId"
            id={recipe.id}
            label={recipe.title}
            editTitle={say(RECIPES.editRecipe)}
            editAction={updateRecipe}
            editOverlay={recipeSaveOverlay(user.homeLanguage, {
              ...recipe,
              inFormat: isInFormat(recipe.cookSteps),
            })}
            deleteAction={deleteRecipe}
            deleteMessage={say(RECIPES.deleteRecipeMessage, { title: recipe.title })}
            extraItems={<AddToMealPlanMenuItem recipeId={recipe.id} />}
            className="-mr-2"
          >
            <RecipeFields
              recipe={{
                ...recipe,
                categoryIds: recipe.categories.map((filed) => filed.category.id),
              }}
              categories={categories}
              language={user.homeLanguage}
            />
          </ItemMenu>
        </div>
      </div>

      <PhotoBanner photoId={recipe.photoId} alt={recipe.title} className="mb-6" placeholder="recipe" />

      {/* Start cooking, drawn only where there is something to cook — a recipe that is
          only a link has no steps to turn. Go to link, beside it rather than instead of
          it, for the source itself: a video-only recipe still needs a way to reach it now
          that it is no longer embedded on this page. */}
      {(instructions.length > 0 || videoHref) && (
        <div className="mb-6 flex flex-wrap gap-2">
          {instructions.length > 0 && (
            <ButtonLink href={`/recipes/${recipe.id}/cook`} className="flex-1 sm:flex-none">
              {say(RECIPES.startCooking)}
            </ButtonLink>
          )}
          {videoHref && (
            <ButtonLink
              href={videoHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              className="flex-1 sm:flex-none"
            >
              {say(RECIPES.goToLink)}
            </ButtonLink>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="mt-2 shrink-0 text-sm font-semibold text-slate-500 uppercase">
              {say(RECIPES.ingredientsHeading)}
            </h2>
            {/* Only where there is something to add. A recipe still being written would
                otherwise offer to put nothing on a list. */}
            {ingredients.length > 0 && (
              <AddToListMenu
                action={addRecipeIngredients}
                extraData={{ recipeId: recipe.id }}
                lists={lists.map((list) => ({
                  id: list.id,
                  title: list.title,
                  open: list._count.items,
                }))}
              />
            )}
          </div>
          {ingredients.length === 0 ? (
            <p className="text-sm text-slate-500">{say(RECIPES.noneListed)}</p>
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
          <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
            {say(RECIPES.instructionsHeading)}
          </h2>
          {instructions.length === 0 ? (
            <p className="text-sm text-slate-500">{say(RECIPES.noneWrittenFollowVideo)}</p>
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
