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
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);

  // Both scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point. Asked
  // together rather than one after the other: how many people are in this home decides
  // only whether a ticked row says who got it, and the page waits for both either way.
  const [list, members] = await Promise.all([
    homeDb(user.homeId).list.findUnique({
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
            // Who ticked it off, where anybody has. Only what the mark beside the row
            // draws: a name, and the id of a picture fetched by URL like every other.
            completedBy: { select: { id: true, name: true, photoId: true } },
          },
        },
        // Only the caller's own star — favourites are personal.
        favorites: { where: { userId: user.id }, select: { userId: true } },
      },
    }),
    homeDb(user.homeId).homeMember.count(),
  ]);
  if (!list) notFound();

  const ticked = list.items.filter((item) => item.done);

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {/* Decorative: the title is right beside it. */}
          <PhotoThumb photoId={list.photoId} alt="" className="mr-3 h-11 w-11 shrink-0" placeholder="list" />
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
          editTitle={say(LISTS.editList)}
          editAction={updateList}
          deleteAction={deleteList}
          deleteMessage={say(LISTS.deleteListMessage, { title: list.title })}
          className="-mr-2"
        >
          <div className="space-y-1">
            <Label htmlFor="title">{say(LISTS.listName)}</Label>
            <Input id="title" name="title" defaultValue={list.title} required autoFocus />
          </div>
          <AmountsField defaultChecked={list.trackAmounts} language={user.homeLanguage} />
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
          me={{ id: user.id, name: user.name, photoId: user.photoId }}
          shared={members > 1}
        />
      </Card>
    </>
  );
}
