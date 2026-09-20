import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createPantryItem, deletePantryItem, renamePantryItem } from "@/app/actions/pantry";
import { Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { ItemMenu } from "@/components/item-menu";
import { PantryStock } from "@/components/pantry-stock";

/**
 * What the household keeps in, so that adding a recipe to a shopping list stops asking
 * it to buy salt.
 *
 * Reached from the home's own name in the header, beside Settings — it belongs to this
 * household rather than to the person reading it, and unlike Settings it is everybody's:
 * whoever finds the rice jar empty is who should be able to say so. A page rather than a
 * card on Settings because it is used, not configured, and because Settings is a page
 * half this home cannot open.
 *
 * Ordered by name and not by what has run out. The two questions asked of this page are
 * "is the rice in" and "we've run out of rice" — both of them begin by finding rice, and
 * a list that reordered itself under the household's thumb every time something was
 * ticked would answer neither.
 */
export default async function PantryPage() {
  const user = await requireHomeUser();
  const items = await homeDb(user.homeId).pantryItem.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Pantry"
        description="The basics you always have in. A recipe added to a shopping list leaves these off — untick anything you have run out of and it goes back on."
      />

      <Card>
        <ActionForm
          action={createPantryItem}
          submitLabel="Add to pantry"
          successLabel="Added."
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="pantry-name">Something you keep in</Label>
            {/* One thing per entry, written the way it would go on a shopping list:
                that is what it is matched against. "Salt and pepper" is two entries. */}
            <Input id="pantry-name" name="name" placeholder="Salt" required />
          </div>
        </ActionForm>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon="🧂">
          <p>Nothing in the pantry yet.</p>
          <p className="mt-2">
            Add the lines your recipes open with — salt, pepper, oil, butter, flour — and
            they will stop turning up on the shopping.
          </p>
        </EmptyState>
      ) : (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-1.5">
              <PantryStock id={item.id} name={item.name} inStock={item.inStock} />
              <ItemMenu
                name="pantryItemId"
                id={item.id}
                label={item.name}
                editTitle="Rename"
                editAction={renamePantryItem}
                deleteAction={deletePantryItem}
                deleteTitle="Remove from pantry"
                deleteMessage={`Stop treating “${item.name}” as something you always have in? Recipes asking for it will put it on the shopping list again.`}
                deleteConfirmLabel="Remove"
                className="-mr-2"
              >
                <div className="space-y-1">
                  <Label htmlFor={`pantry-name-${item.id}`}>Name</Label>
                  <Input
                    id={`pantry-name-${item.id}`}
                    name="name"
                    defaultValue={item.name}
                    required
                  />
                </div>
              </ItemMenu>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
