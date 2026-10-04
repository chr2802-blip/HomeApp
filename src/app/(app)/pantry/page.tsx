import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { addPantryToList } from "@/app/actions/pantry";
import { EmptyState, PageHeader } from "@/components/ui";
import { AddToListMenu } from "@/components/add-to-list-menu";
import { PantryAddDialog } from "@/components/pantry-add-dialog";
import { PantryShelves } from "@/components/pantry-shelves";
import { PantryCook } from "@/components/pantry-cook";
import { sayIn } from "@/lib/copy/say";
import { PANTRY } from "@/lib/copy/pantry";
import { expiryWarning } from "@/lib/pantry";
import { shelfOf, shelvesOf } from "@/lib/pantry-shelves";

/**
 * A model call runs from this page — sorting what nobody could place (`sortPantry`)
 * — and has to fail inside the route rather than be cut off by the
 * platform. `tests/unit/ai-readers.test.ts` adds the worst case up against this.
 */
export const maxDuration = 60;

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
 * Grouped by shelf, in the order `shelvesOf` gives — the built-ins, the household's own,
 * then Other — because a cupboard is
 * looked through a shelf at a time — "which spices do we have" is a question a single
 * alphabet made somebody read forty rows to answer. Entries nobody has filed yet come
 * first, under "Not sorted yet" with the button that files them, because that heading is
 * the one asking for something. An empty shelf is not drawn.
 *
 * Every shelf starts folded, saying what it holds and how much of it has run out, so the
 * whole cupboard reads on one screen; a search box and an "only run out" switch narrow
 * the shelves and open the ones that match — see `PantryShelves`.
 *
 * Within a shelf, ordered by name and not by what has run out. The two questions asked of this page are
 * "is the rice in" and "we've run out of rice" — both of them begin by finding rice, and
 * a list that reordered itself under the household's thumb every time something was
 * switched off would answer neither.
 */
export default async function PantryPage() {
  const user = await requireHomeUser();
  const now = new Date();
  const say = sayIn(user.homeLanguage);
  const db = homeDb(user.homeId);

  const [items, ownShelves, shoppingLists] = await Promise.all([
    db.pantryItem.findMany({ orderBy: { name: "asc" } }),
    // The household's own shelves, made in Settings, drawn among the built-in ones.
    db.pantryShelf.findMany({ select: { id: true, name: true } }),
    // The same lists the recipe page and the meal plan offer, filtered the same way: an
    // ingredient line is a quantity, and a list that ignores amounts has nowhere to put
    // one.
    db.list.findMany({
      where: { trackAmounts: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, _count: { select: { items: { where: { done: false } } } } },
    }),
  ]);

  const shelves = shelvesOf(ownShelves, user.homeLanguage);

  return (
    <>
      <PageHeader
        title={say(PANTRY.title)}
        description={say(PANTRY.description)}
        action={
          /* The green "+" every page adds with, and the sheet behind it. */
          <PantryAddDialog
              kept={items.map((item) => ({ id: item.id, name: item.name, key: item.key }))}
              shelves={shelves}
            />
        }
      />

      {/* Mounted even while the pantry is empty, with the empty state inside it: the
          shelves open the shelf a new entry lands on by noticing it arrive, and the very
          first entry would otherwise arrive in a component mounting with it already
          there — folded away under the heading of the thing just added. */}
      <PantryShelves
        shelves={shelves}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          key: item.key,
          quantity: item.quantity,
          unit: item.unit,
          shelf: shelfOf(item),
          expiresOn: item.expiresOn,
          photoId: item.photoId,
          // Counted here, on the household's clock, rather than in the row — a row
          // counting on the phone's own clock could disagree with this render at midnight.
          expiresIn: expiryWarning(item.expiresOn, now),
        }))}
        cook={<PantryCook />}
        addToList={
          <AddToListMenu
            sheet
            lists={shoppingLists.map((list) => ({
              id: list.id,
              title: list.title,
              open: list._count.items,
            }))}
            action={addPantryToList}
            extraData={{}}
          />
        }
      >
        <EmptyState art="jars">
          <p>{say(PANTRY.empty)}</p>
          <p className="mt-2">{say(PANTRY.emptyHint)}</p>
        </EmptyState>
      </PantryShelves>
    </>
  );
}
