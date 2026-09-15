import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { addListItem, deleteList, updateList } from "@/app/actions/lists";
import { Card, Input, Label } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ListItems } from "@/components/list-items";
import { FormDialog } from "@/components/form-dialog";
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
      items: { orderBy: [{ done: "asc" }, { position: "asc" }] },
      // Only the caller's own star — favourites are personal.
      favorites: { where: { userId: user.id }, select: { userId: true } },
    },
  });
  if (!list) notFound();

  const ticked = list.items.filter((item) => item.done);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <FavoriteButton
            listId={list.id}
            title={list.title}
            favorite={list.favorites.length > 0}
            className="-ml-2"
          />
          {/* Decorative: the title is right beside it. */}
          <PhotoThumb photoId={list.photoId} alt="" className="mr-1 h-11 w-11" />
          <h1 className="text-2xl font-semibold tracking-tight">{list.title}</h1>
        </div>
        <div className="flex gap-2">
          <FormDialog
            triggerLabel="Edit"
            triggerVariant="secondary"
            triggerIcon="pencil"
            title="Edit list"
            submitLabel="Save changes"
            action={updateList}
          >
            <input type="hidden" name="listId" value={list.id} />
            <div className="space-y-1">
              <Label htmlFor="title">List name</Label>
              <Input id="title" name="title" defaultValue={list.title} required autoFocus />
            </div>
            <AmountsField defaultChecked={list.trackAmounts} />
            <PhotoField defaultPhotoId={list.photoId} />
          </FormDialog>
          <form action={deleteList}>
            <input type="hidden" name="listId" value={list.id} />
            <ConfirmButton message={`Delete "${list.title}" and all its items?`}>
              Delete
            </ConfirmButton>
          </form>
        </div>
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
        <ListItems listId={list.id} items={list.items} trackAmounts={list.trackAmounts} />
      </Card>
    </>
  );
}
