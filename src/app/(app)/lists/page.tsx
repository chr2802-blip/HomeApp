import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { createList } from "@/app/actions/lists";
import { Input, Label, PageHeader } from "@/components/ui";
import { FormDialog } from "@/components/form-dialog";
import { AmountsField } from "@/components/amounts-field";
import { PhotoField } from "@/components/photo-field";
import { ListDirectory, type ListSummary } from "@/components/list-directory";

export default async function ListsPage() {
  const user = await requireHomeUser();

  const lists = await homeDb(user.homeId).list.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
      items: { where: { done: false }, select: { id: true } },
      // Only the caller's own star: favourites are personal, and the page has no use
      // for anybody else's.
      favorites: { where: { userId: user.id }, select: { userId: true } },
    },
  });

  // Favourites first, each group keeping the newest-first order. Sorted here rather
  // than in the query because "is starred by this person" is a property of the
  // included rows, not a column to order by.
  const summaries: ListSummary[] = lists
    .map((list) => ({
      id: list.id,
      title: list.title,
      photoId: list.photoId,
      open: list.items.length,
      total: list._count.items,
      favorite: list.favorites.length > 0,
    }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite));

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
            <PhotoField hint="Optional — a picture makes the list easy to pick out." />
          </FormDialog>
        }
      />

      <ListDirectory lists={summaries} />
    </>
  );
}
