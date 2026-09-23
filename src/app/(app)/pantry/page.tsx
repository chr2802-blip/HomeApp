import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { addPantryToList, createPantryItem } from "@/app/actions/pantry";
import { Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { AddToListMenu } from "@/components/add-to-list-menu";
import { PantryRow } from "@/components/pantry-row";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { PANTRY } from "@/lib/copy/pantry";

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
 * switched off would answer neither.
 */
export default async function PantryPage() {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const db = homeDb(user.homeId);

  const [items, shoppingLists] = await Promise.all([
    db.pantryItem.findMany({ orderBy: { name: "asc" } }),
    // The same lists the recipe page and the meal plan offer, filtered the same way: an
    // ingredient line is a quantity, and a list that ignores amounts has nowhere to put
    // one.
    db.list.findMany({
      where: { trackAmounts: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, _count: { select: { items: { where: { done: false } } } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={say(PANTRY.title)}
        description={say(PANTRY.description)}
        action={
          // Drawn whenever the pantry has anything in it at all, rather than only when
          // something has run out: the switches are optimistic, so a button that came
          // and went with the count would arrive a beat after the thumb that caused it.
          // Pressed on a full cupboard it says so, which is the same answer.
          items.length > 0 ? (
            <AddToListMenu
              lists={shoppingLists.map((list) => ({
                id: list.id,
                title: list.title,
                open: list._count.items,
              }))}
              action={addPantryToList}
              extraData={{}}
            />
          ) : undefined
        }
      />

      <Card>
        <ActionForm
          action={createPantryItem}
          submitLabel={say(PANTRY.add)}
          successLabel={say(APP.added)}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-48 flex-1 space-y-1">
            <Label htmlFor="pantry-name">{say(PANTRY.nameLabel)}</Label>
            {/* One thing per entry, written the way it would go on a shopping list:
                that is what it is matched against. "Salt and pepper" is two entries. */}
            <Input id="pantry-name" name="name" placeholder={say(PANTRY.namePlaceholder)} required />
          </div>
        </ActionForm>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon="🧂">
          <p>{say(PANTRY.empty)}</p>
          <p className="mt-2">{say(PANTRY.emptyHint)}</p>
        </EmptyState>
      ) : (
        <Card className="mt-3 divide-y divide-slate-100 p-0">
          {items.map((item) => (
            <PantryRow
              key={item.id}
              id={item.id}
              name={item.name}
              quantity={item.quantity}
              unit={item.unit}
            />
          ))}
        </Card>
      )}
    </>
  );
}
