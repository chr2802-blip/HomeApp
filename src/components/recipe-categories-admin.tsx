import type { HomeLanguage } from "@prisma/client";
import { homeDb } from "@/lib/home-db";
import {
  createRecipeCategory,
  deleteRecipeCategory,
  renameRecipeCategory,
} from "@/app/actions/recipe-categories";
import { Badge, Card, Input, Label } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ItemMenu } from "@/components/item-menu";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

/**
 * Whether a category is offered as tonight's dinner. Shared by the add and rename
 * forms, so the field name and its wording cannot drift between the two — a household
 * that ticks it for "Baby food" gets the same effect however that category was made.
 */
function ExcludeFromSuggestionField({
  defaultChecked = false,
  language,
}: {
  defaultChecked?: boolean;
  language: HomeLanguage;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name="excludeFromSuggestion"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 accent-slate-900"
      />
      {sayIn(language)(RECIPES.skipForSuggestions)}
    </label>
  );
}

/**
 * The headings this home files its recipes under.
 *
 * A category holding recipes has no Delete button at all: every recipe must have a
 * category, so removing one in use would either destroy the recipes or move them
 * somewhere nobody chose. The count stands in its place, which also answers the
 * question an admin has before reaching for Delete — "is anything in here?".
 */
export async function RecipeCategoriesAdmin({
  homeId,
  language,
}: {
  homeId: string;
  language: HomeLanguage;
}) {
  const categories = await homeDb(homeId).recipeCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipes: true } } },
  });
  const say = sayIn(language);

  return (
    <>
      <Card>
        <ActionForm
          action={createRecipeCategory}
          submitLabel={say(RECIPES.addCategory)}
          successLabel={say(RECIPES.categoryAdded)}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="category-name">{say(RECIPES.newCategory)}</Label>
            <Input
              id="category-name"
              name="name"
              placeholder={say(RECIPES.categoryNamePlaceholder)}
              required
            />
          </div>
          <ExcludeFromSuggestionField language={language} />
        </ActionForm>
      </Card>

      {categories.length > 0 && (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <ActionForm
                action={renameRecipeCategory}
                submitLabel={say(RECIPES.rename)}
                successLabel={say(RECIPES.renamed)}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              >
                <input type="hidden" name="categoryId" value={category.id} />
                <Input
                  name="name"
                  defaultValue={category.name}
                  aria-label={say(RECIPES.nameOfCategory, { name: category.name })}
                  required
                  className="min-w-40 flex-1"
                />
                <ExcludeFromSuggestionField
                  defaultChecked={category.excludeFromSuggestion}
                  language={language}
                />
              </ActionForm>

              {category._count.recipes > 0 ? (
                <Badge>{say(RECIPES.categoryCount, { count: category._count.recipes })}</Badge>
              ) : (
                <ItemMenu
                  name="categoryId"
                  id={category.id}
                  label={category.name}
                  deleteAction={deleteRecipeCategory}
                  deleteTitle={say(RECIPES.deleteCategory)}
                  deleteMessage={say(RECIPES.deleteCategoryMessage, { name: category.name })}
                  className="-mr-2"
                />
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
