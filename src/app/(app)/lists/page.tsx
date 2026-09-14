import Link from "next/link";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createList, deleteList } from "@/app/actions/lists";
import { Card, EmptyState, Input, Label, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { AmountsField } from "@/components/amounts-field";

export default async function ListsPage() {
  const user = await requireHomeUser();

  const lists = await homeDb(user.homeId).list.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: { where: { done: false }, select: { id: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Lists"
        description="Shopping lists, to-dos, anything you want to tick off."
        action={
          <FormDialog
            triggerLabel="New list"
            title="New list"
            submitLabel="Create list"
            action={createList}
          >
            <div className="space-y-1">
              <Label htmlFor="title">List name</Label>
              <Input id="title" name="title" placeholder="Shopping list" required autoFocus />
            </div>
            <AmountsField />
          </FormDialog>
        }
      />

      {lists.length === 0 ? (
        <EmptyState>No lists yet — create your first one with the button above.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((list, index) => (
            <Card
              key={list.id}
              className="animate-row-in flex items-start justify-between gap-3 transition hover:border-slate-400"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <Link
                href={`/lists/${list.id}`}
                prefetch
                className="pressable -m-2 min-w-0 flex-1 rounded-lg p-2 active:scale-[0.98] active:bg-slate-50"
              >
                <p className="font-medium hover:underline">{list.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {list.items.length} open · {list._count.items} total
                </p>
              </Link>
              <form action={deleteList}>
                <input type="hidden" name="listId" value={list.id} />
                <ConfirmButton message={`Delete "${list.title}" and all its items?`}>
                  Delete
                </ConfirmButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
