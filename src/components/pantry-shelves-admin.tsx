import type { HomeLanguage } from "@prisma/client";
import { homeDb } from "@/lib/home-db";
import { createPantryShelf, deletePantryShelf, renamePantryShelf } from "@/app/actions/pantry-shelves";
import { Card, Input, Label } from "@/components/ui";
import { ItemMenu } from "@/components/item-menu";
import { Collapsible } from "@/components/collapsible";
import { CategoryRow, CategorySection, initialOf } from "@/components/category-admin";
import { PANTRY_CATEGORIES } from "@/lib/pantry";
import { sayIn } from "@/lib/copy/say";
import { PANTRY_CATEGORY_LABELS, PANTRY_SHELVES } from "@/lib/copy/pantry";

function ShelfFields({ name = "", language }: { name?: string; language: HomeLanguage }) {
  const say = sayIn(language);
  return (
    <div className="space-y-1">
      <Label htmlFor="shelf-name">{say(PANTRY_SHELVES.name)}</Label>
      <Input
        id="shelf-name"
        name="name"
        defaultValue={name}
        placeholder={say(PANTRY_SHELVES.namePlaceholder)}
        required
      />
    </div>
  );
}

/**
 * The pantry's shelves, as a household's admins keep them: the ones they made, which
 * they can rename and delete, and under them — folded, because they are the same in
 * every home and nothing about them can be changed — the built-in ones, so the list
 * answers "what shelves do we have" whole. Each says how much is on it.
 */
export async function PantryShelvesAdmin({ homeId, language }: { homeId: string; language: HomeLanguage }) {
  const db = homeDb(homeId);
  const [shelves, builtInCounts] = await Promise.all([
    db.pantryShelf.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true } } },
    }),
    db.pantryItem.groupBy({ by: ["category"], where: { shelfId: null }, _count: { _all: true } }),
  ]);
  const say = sayIn(language);
  const onBuiltIn = new Map(builtInCounts.map((group) => [group.category, group._count._all]));
  const countLine = (count: number) =>
    count > 0 ? say(PANTRY_SHELVES.count, { count }) : say(PANTRY_SHELVES.empty);

  return (
    <CategorySection
      title={say(PANTRY_SHELVES.heading)}
      intro={say(PANTRY_SHELVES.intro)}
      addLabel={say(PANTRY_SHELVES.add)}
      addTitle={say(PANTRY_SHELVES.newTitle)}
      addSubmit={say(PANTRY_SHELVES.create)}
      addAction={createPantryShelf}
      addFields={<ShelfFields language={language} />}
    >
      <Card padded={false} className="divide-y divide-slate-100" data-testid="pantry-shelves">
        {shelves.length === 0 && (
          <p className="px-4 py-4 text-sm text-slate-500">{say(PANTRY_SHELVES.noneYet)}</p>
        )}
        {shelves.map((shelf) => {
          const count = shelf._count.items;
          return (
            <CategoryRow
              key={shelf.id}
              name={shelf.name}
              detail={countLine(count)}
              mark={initialOf(shelf.name)}
              menu={
                <ItemMenu
                  name="shelfId"
                  id={shelf.id}
                  label={shelf.name}
                  editAction={renamePantryShelf}
                  editTitle={say(PANTRY_SHELVES.editTitle)}
                  deleteAction={deletePantryShelf}
                  deleteTitle={say(PANTRY_SHELVES.deleteTitle)}
                  deleteMessage={
                    count > 0
                      ? say(PANTRY_SHELVES.deleteMessageInUse, { name: shelf.name, count })
                      : say(PANTRY_SHELVES.deleteMessage, { name: shelf.name })
                  }
                  className="-mr-2"
                >
                  <ShelfFields name={shelf.name} language={language} />
                </ItemMenu>
              }
            />
          );
        })}
      </Card>

      <Collapsible
        summary={
          <span className="text-sm font-medium text-slate-600">
            {say(PANTRY_SHELVES.builtIn)} <span className="text-slate-400">{PANTRY_CATEGORIES.length}</span>
          </span>
        }
        triggerClassName="mt-3 px-1 py-1 text-slate-500"
      >
        <Card padded={false} className="mt-2 divide-y divide-slate-100">
          {PANTRY_CATEGORIES.map((category) => {
            const name = say(PANTRY_CATEGORY_LABELS[category]);
            return (
              <CategoryRow
                key={category}
                name={name}
                detail={countLine(onBuiltIn.get(category) ?? 0)}
                mark={initialOf(name)}
              />
            );
          })}
        </Card>
      </Collapsible>
    </CategorySection>
  );
}
