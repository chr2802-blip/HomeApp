import type { HomeLanguage } from "@prisma/client";
import { homeDb } from "@/lib/home-db";
import {
  createRecipeCategory,
  deleteRecipeCategory,
  renameRecipeCategory,
} from "@/app/actions/recipe-categories";
import { Card, Input, Label } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { CategoryRow, CategorySection, initialOf } from "@/components/category-admin";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

/**
 * A category's two questions, shared by the add sheet and the edit sheet so the field
 * names and their wording cannot drift between the two — a household that ticks "skip"
 * for "Baby food" gets the same effect however that category was made.
 */
function CategoryFields({
  name = "",
  excluded = false,
  language,
}: {
  name?: string;
  excluded?: boolean;
  language: HomeLanguage;
}) {
  const say = sayIn(language);
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="category-name">{say(RECIPES.categoryName)}</Label>
        <Input
          id="category-name"
          name="name"
          defaultValue={name}
          placeholder={say(RECIPES.categoryNamePlaceholder)}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="excludeFromSuggestion"
          defaultChecked={excluded}
          className="h-4 w-4 rounded border-slate-300 accent-[var(--accent)]"
        />
        {say(RECIPES.skipForSuggestions)}
      </label>
    </>
  );
}

/**
 * The headings this home files its recipes under.
 *
 * A category holding recipes offers no Delete at all: every recipe must have a
 * category, so removing one in use would either destroy the recipes or move them
 * somewhere nobody chose. Its line says how many are in it instead, which also answers
 * the question an admin has before reaching for Delete — "is anything in here?".
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
    <CategorySection
      title={say(RECIPES.recipeCategoriesHeading)}
      intro={say(RECIPES.categoriesIntro)}
      addLabel={say(RECIPES.addCategory)}
      addTitle={say(RECIPES.newCategory)}
      addSubmit={say(RECIPES.categoryCreate)}
      addAction={createRecipeCategory}
      addFields={<CategoryFields language={language} />}
    >
      <Card padded={false} className="divide-y divide-slate-100" data-testid="recipe-categories">
        {categories.length === 0 && (
          <p className="px-4 py-4 text-sm text-slate-500">{say(RECIPES.noCategoriesAdmin)}</p>
        )}
        {categories.map((category) => {
          const count = category._count.recipes;
          const detail = [
            count > 0 ? say(RECIPES.categoryCount, { count }) : say(RECIPES.categoryEmpty),
            ...(category.excludeFromSuggestion ? [say(RECIPES.notSuggested)] : []),
          ].join(" · ");
          return (
            <CategoryRow
              key={category.id}
              name={category.name}
              detail={detail}
              mark={initialOf(category.name)}
              menu={
                <ItemMenu
                  name="categoryId"
                  id={category.id}
                  label={category.name}
                  editAction={renameRecipeCategory}
                  editTitle={say(RECIPES.editCategory)}
                  deleteAction={count > 0 ? undefined : deleteRecipeCategory}
                  deleteTitle={say(RECIPES.deleteCategory)}
                  deleteMessage={say(RECIPES.deleteCategoryMessage, { name: category.name })}
                  className="-mr-2"
                >
                  <CategoryFields
                    name={category.name}
                    excluded={category.excludeFromSuggestion}
                    language={language}
                  />
                </ItemMenu>
              }
            />
          );
        })}
      </Card>
    </CategorySection>
  );
}
