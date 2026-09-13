import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { addListItem, clearCompletedItems, deleteList, renameList } from "@/app/actions/lists";
import { Card, Input, Label } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { ListItems } from "@/components/list-items";
import { FormDialog } from "@/components/form-dialog";
import { AddItemForm } from "@/components/add-item-form";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  // Scoped to the caller's home, so another home's id simply finds nothing —
  // indistinguishable from a record that never existed, which is the point.
  const list = await homeDb(user.homeId).list.findUnique({
    where: { id },
    include: { items: { orderBy: [{ done: "asc" }, { position: "asc" }] } },
  });
  if (!list) notFound();

  const ticked = list.items.filter((item) => item.done);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{list.title}</h1>
        <div className="flex gap-2">
          <FormDialog
            triggerLabel="Edit"
            triggerVariant="secondary"
            triggerIcon="pencil"
            title="Edit list"
            submitLabel="Save changes"
            action={renameList}
          >
            <input type="hidden" name="listId" value={list.id} />
            <div className="space-y-1">
              <Label htmlFor="title">List name</Label>
              <Input id="title" name="title" defaultValue={list.title} required autoFocus />
            </div>
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
          suggestions={ticked.map((item) => ({ id: item.id, text: item.text }))}
        />
      </Card>

      <Card className="divide-y divide-slate-100 p-0">
        <ListItems listId={list.id} items={list.items} />
      </Card>

      {ticked.length > 0 && (
        <form action={clearCompletedItems} className="mt-4">
          <input type="hidden" name="listId" value={list.id} />
          <SubmitButton variant="secondary" pendingLabel="Clearing…">
            Clear {ticked.length} completed
          </SubmitButton>
        </form>
      )}
    </>
  );
}
