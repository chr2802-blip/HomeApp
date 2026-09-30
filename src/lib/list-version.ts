/**
 * One short string that changes whenever anything a list's page draws has changed.
 *
 * Two people shop from the same list at the same time, and a tick on one phone has to
 * reach the other before somebody picks up a second carton of milk. The page is a
 * server component, so the other phone already knows how to redraw itself — a
 * `router.refresh()` — and the only thing it lacks is knowing *when*. This is that:
 * the page draws its rows and this string from the same query, and an open list asks
 * `/api/lists/<id>/version` for the string every few seconds, refreshing only when the
 * two differ. See `useListFollow`.
 *
 * Asked of the rows themselves rather than of a timestamp, because `ListItem` carries
 * none, and a column written on every change would be one more thing every write has
 * to remember — the one that forgot would be the change that never arrives. What is
 * hashed is exactly what the page shows: a field left out here is a change the other
 * phone never sees, and one put in that the page does not draw is a refresh for nothing.
 *
 * What makes a phone ask sooner than its timer is a nudge pushed through Supabase
 * Realtime (`src/lib/realtime.ts`) — but the nudge only says *that* a list changed, and
 * this is still the one answer to *whether this phone is behind*.
 */
export type VersionedList = {
  title: string;
  trackAmounts: boolean;
  photoId: string | null;
  items: {
    id: string;
    text: string;
    amount: number;
    done: boolean;
    position: number;
    completedById: string | null;
    /** The recipes that put the item there, in the order the page lists them. */
    sourceIds: string[];
  }[];
};

export function listVersion(list: VersionedList): string {
  // Sorted by id, so two queries that happen to break a tie in the page's own order
  // differently still agree.
  const items = [...list.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const text = JSON.stringify([
    list.title,
    list.trackAmounts,
    list.photoId,
    items.map((item) => [
      item.id,
      item.text,
      item.amount,
      item.done,
      item.position,
      item.completedById,
      item.sourceIds,
    ]),
  ]);
  return fnv1a(text);
}

/**
 * FNV-1a, 32 bits, as hex. Not a security boundary — the caller could read the rows
 * anyway — only a way to send eight characters every few seconds rather than the list.
 * Plain arithmetic so the page and the route compute it identically, with no `crypto`
 * to import on either side.
 */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
