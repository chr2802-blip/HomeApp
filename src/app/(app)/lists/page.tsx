import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { openItemCounts } from "@/lib/list-counts";
import { createList } from "@/app/actions/lists";
import { Input, Label, PageHeader } from "@/components/ui";
import { FormDialog } from "@/components/form-dialog";
import { AmountsField } from "@/components/amounts-field";
import { PhotoField } from "@/components/photo-field";
import { ListDirectory, type ListSummary } from "@/components/list-directory";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

export default async function ListsPage() {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);

  // The lists themselves, and how much of each is still open. Two queries rather than
  // one because a relation can only be counted one way per query — see `openItemCounts`
  // — and both are counts, so neither fetches an item row to arrive at a number.
  const [lists, open] = await Promise.all([
    homeDb(user.homeId).list.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
        // Only the caller's own star: favourites are personal, and the page has no use
        // for anybody else's.
        favorites: { where: { userId: user.id }, select: { userId: true } },
      },
    }),
    openItemCounts(user.homeId),
  ]);

  // Favourites first, each group keeping the newest-first order. Sorted here rather
  // than in the query because "is starred by this person" is a property of the
  // included rows, not a column to order by.
  const summaries: ListSummary[] = lists
    .map((list) => ({
      id: list.id,
      title: list.title,
      photoId: list.photoId,
      trackAmounts: list.trackAmounts,
      open: open.get(list.id) ?? 0,
      total: list._count.items,
      favorite: list.favorites.length > 0,
    }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite));

  return (
    <>
      <PageHeader
        title={say(LISTS.title)}
        description={say(LISTS.description)}
        action={
          <FormDialog
            triggerLabel={say(LISTS.newList)}
            triggerVariant="create"
            triggerShape="icon"
            title={say(LISTS.newList)}
            submitLabel={say(LISTS.createList)}
            action={createList}
          >
            <div className="space-y-1">
              <Label htmlFor="title">{say(LISTS.listName)}</Label>
              <Input id="title" name="title" placeholder={say(LISTS.namePlaceholder)} required autoFocus />
            </div>
            <AmountsField language={user.homeLanguage} />
            <PhotoField hint={say(LISTS.photoHint)} />
          </FormDialog>
        }
      />

      <ListDirectory lists={summaries} />
    </>
  );
}
