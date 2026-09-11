import { notFound } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessHome } from "@/lib/access";
import { addListItem, clearCompletedItems, deleteList, renameList } from "@/app/actions/lists";
import { Card, Input, Label } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { ListItems } from "@/components/list-items";
import { FormDialog } from "@/components/form-dialog";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireHomeUser();

  const list = await prisma.list.findUnique({
    where: { id },
    include: { items: { orderBy: [{ done: "asc" }, { position: "asc" }] } },
  });
  if (!list || !canAccessHome(user, list.homeId)) notFound();

  const doneCount = list.items.filter((item) => item.done).length;

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
        <form action={addListItem} className="flex flex-wrap gap-2">
          <input type="hidden" name="listId" value={list.id} />
          <Input name="text" placeholder="Add an item" required className="flex-1" />
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
        </form>
      </Card>

      <Card className="divide-y divide-slate-100 p-0">
        <ListItems items={list.items} />
      </Card>

      {doneCount > 0 && (
        <form action={clearCompletedItems} className="mt-4">
          <input type="hidden" name="listId" value={list.id} />
          <SubmitButton variant="secondary" pendingLabel="Clearing…">
            Clear {doneCount} completed
          </SubmitButton>
        </form>
      )}
    </>
  );
}
