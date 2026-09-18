import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { addListItem, deleteList, updateList } from "@/app/actions/lists";
import { Card, Input, Label } from "@/components/ui";
import { ListItems } from "@/components/list-items";
import { ItemMenu } from "@/components/item-menu";
import { AmountsField } from "@/components/amounts-field";
import { FavoriteButton } from "@/components/favorite-button";
import { AddItemForm } from "@/components/add-item-form";
import { PhotoField } from "@/components/photo-field";
import { PhotoThumb } from "@/components/photo";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const list = await homeDb(user.homeId).list.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ done: "asc" }, { position: "asc" }],
        // Which recipes put each item here, oldest first, so an item wanted by two
        // recipes names them in the order they asked for it.
        include: {
          sources: {
            orderBy: { createdAt: "asc" },
            select: { recipe: { select: { id: true, title: true } } },
          },
        },
      },
      // Only the caller's own star — favourites are personal.
      favorites: { where: { userId: user.id }, select: { userId: true } },
    },
  });
  if (!list) notFound();

  const ticked = list.items.filter((item) => item.done);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {/* Decorative: the title is right beside it. */}
          <PhotoThumb photoId={list.photoId} alt="" className="mr-3 h-11 w-11 shrink-0" />
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight break-words">
            {list.title}
          </h1>
          {/* After the title rather than before it: the star belongs to the list it
              names, and reading the name first is what makes that plain. */}
          <FavoriteButton
            listId={list.id}
            title={list.title}
            favorite={list.favorites.length > 0}
          />
        </div>
        <ItemMenu
          name="listId"
          id={list.id}
          label={list.title}
          editTitle="Edit list"
          editAction={updateList}
          deleteAction={deleteList}
          deleteMessage={`Delete "${list.title}" and all its items?`}
          className="-mr-2"
        >
          <div className="space-y-1">
            <Label htmlFor="title">List name</Label>
            <Input id="title" name="title" defaultValue={list.title} required autoFocus />
          </div>
          <AmountsField defaultChecked={list.trackAmounts} />
          <PhotoField defaultPhotoId={list.photoId} />
        </ItemMenu>
      </div>

      <Card className="mb-4">
        <AddItemForm
          action={addListItem}
          listId={list.id}
          trackAmounts={list.trackAmounts}
          suggestions={ticked.map((item) => ({ id: item.id, text: item.text }))}
        />
      </Card>

      <Card className="divide-y divide-slate-100 p-0">
        <ListItems
          listId={list.id}
          items={list.items.map((item) => ({
            ...item,
            sources: item.sources.map((source) => source.recipe),
          }))}
          trackAmounts={list.trackAmounts}
        />
      </Card>
    </>
  );
}
