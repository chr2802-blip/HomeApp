import { homeDb } from "@/lib/home-db";
import {
  createRecipeCategory,
  deleteRecipeCategory,
  renameRecipeCategory,
} from "@/app/actions/recipe-categories";
import { Badge, Card, Input, Label } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ItemMenu } from "@/components/item-menu";

/**
 * Whether a category is offered as tonight's dinner. Shared by the add and rename
 * forms, so the field name and its wording cannot drift between the two — a household
 * that ticks it for "Baby food" gets the same effect however that category was made.
 */
function ExcludeFromSuggestionField({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name="excludeFromSuggestion"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 accent-slate-900"
      />
      Skip for dinner suggestions
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
export async function RecipeCategoriesAdmin({ homeId }: { homeId: string }) {
  const categories = await homeDb(homeId).recipeCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipes: true } } },
  });

  return (
    <>
      <Card>
        <ActionForm
          action={createRecipeCategory}
          submitLabel="Add category"
          successLabel="Category added."
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="category-name">New category</Label>
            <Input id="category-name" name="name" placeholder="Weeknight dinners" required />
          </div>
          <ExcludeFromSuggestionField />
        </ActionForm>
      </Card>

      {categories.length > 0 && (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {categories.map((category) => (
            <div key={category.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <ActionForm
                action={renameRecipeCategory}
                submitLabel="Rename"
                successLabel="Renamed."
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              >
                <input type="hidden" name="categoryId" value={category.id} />
                <Input
                  name="name"
                  defaultValue={category.name}
                  aria-label={`Name of category ${category.name}`}
                  required
                  className="min-w-40 flex-1"
                />
                <ExcludeFromSuggestionField defaultChecked={category.excludeFromSuggestion} />
              </ActionForm>

              {category._count.recipes > 0 ? (
                <Badge>
                  {category._count.recipes}{" "}
                  {category._count.recipes === 1 ? "recipe" : "recipes"}
                </Badge>
              ) : (
                <ItemMenu
                  name="categoryId"
                  id={category.id}
                  label={category.name}
                  deleteAction={deleteRecipeCategory}
                  deleteTitle="Delete category"
                  deleteMessage={`Delete the category "${category.name}"?`}
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
