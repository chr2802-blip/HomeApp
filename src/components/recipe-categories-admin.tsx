import { homeDb } from "@/lib/home-db";
import {
  createRecipeCategory,
  deleteRecipeCategory,
  renameRecipeCategory,
} from "@/app/actions/recipe-categories";
import { Badge, Card, Input, Label } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";

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
              </ActionForm>

              {category._count.recipes > 0 ? (
                <Badge>
                  {category._count.recipes}{" "}
                  {category._count.recipes === 1 ? "recipe" : "recipes"}
                </Badge>
              ) : (
                <form action={deleteRecipeCategory}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <ConfirmButton
                    title="Delete category"
                    confirmLabel="Delete"
                    message={`Delete the category "${category.name}"?`}
                  >
                    Delete
                  </ConfirmButton>
                </form>
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
