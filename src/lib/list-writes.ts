import { prisma } from "@/lib/prisma";
import { recordListCleared } from "@/lib/streak";

/**
 * What it *means* to change a list, with no opinion about who asked.
 *
 * These are the writes themselves, lifted out of the actions in
 * `src/app/actions/lists.ts` so that the offline queue's endpoint can make exactly the
 * same changes rather than its own near-copies of them. The actions still do what an
 * action does — check the caller's home, refresh the views — and `api/lists/sync` does
 * the same checks in its own way; what neither of them does any more is decide
 * separately what a tick is.
 *
 * Every function here takes the state it should end in rather than a change to make, so
 * calling one twice leaves the same row behind as calling it once. That is what lets a
 * queue built on a phone with no signal be sent twice without the household paying for
 * it — see `OfflineOp`.
 */

/** One past the furthest item, so a new or restored item lands at the bottom. */
export async function nextPosition(listId: string) {
  const last = await prisma.listItem.findFirst({
    where: { listId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1;
}

/**
 * Unticks an item and moves it to the end of what is still outstanding, with however
 * many of it are wanted this time rather than last time.
 */
export async function restoreItem(itemId: string, listId: string, amount: number) {
  await prisma.listItem.update({
    where: { id: itemId },
    data: { done: false, amount, position: await nextPosition(listId) },
  });
}

/**
 * Ticks an item off, or puts it back, and counts the tick that empties a list.
 *
 * Told what the row should end up as rather than asked to flip it: two presses that both
 * mean "this is in the basket" must not leave it back on the list.
 *
 * Ticking it off also drops whatever recipe put it there. The note under an item answers
 * "why is this on my list", which is a question about the shop still to do — once the
 * thing is in the basket the recipe has been dealt with, and a ticked row is only next
 * week's vocabulary. Putting it back therefore brings back the item and not the note.
 */
export async function setItemDone(
  item: { id: string; listId: string; done: boolean },
  done: boolean,
  homeId: string,
  byUserId: string,
) {
  // Whether this is the change or the second arrival of one. The row ends up the same
  // either way — that is the point of being told the state rather than asked to flip —
  // but what it *means* for the household differs, and only a change means anything.
  const changed = item.done !== done;

  await prisma.$transaction([
    prisma.listItem.update({
      where: { id: item.id },
      // Who got it, and nobody again the moment it goes back on the list. The name under
      // a ticked row answers "who picked this up", which is a question about the shop
      // still to do — it is not a record of who did what, and it goes the same way the
      // recipe note does.
      data: { done, completedById: done ? byUserId : null },
    }),
    ...(done ? [prisma.listItemSource.deleteMany({ where: { itemId: item.id } })] : []),
  ]);

  // The tick that empties a list is the household's week, so it is counted — after the
  // write, and only when this tick is what left nothing open. A list emptied by deleting
  // its rows reaches the same state and is not counted: nothing was finished. Nor is a
  // tick that was already ticked: a queue sent twice from a phone that spent the
  // afternoon in a shop would otherwise report the shop twice, and the number on the
  // dashboard counts the household's cleared lists rather than its requests.
  if (done && changed) {
    const openLeft = await prisma.listItem.count({ where: { listId: item.listId, done: false } });
    if (openLeft === 0) await recordListCleared(homeId);
  }
}

export type AddOutcome =
  | { ok: true }
  /** Already on the list and not ticked off: the caller has wording to show. */
  | { ok: false; clash: string };

/**
 * Puts something on a list, or brings back the ticked row that already says it.
 *
 * A shopping list is written the same way most weeks, and once everything is ticked off
 * the old entries are exactly the vocabulary for the next shop. Typing "Milk" when a
 * ticked "Milk" is sitting there means "I need milk again", not "make a second milk".
 *
 * `id` is the row's id where the caller has one to give — an item typed with no
 * connection is a row that exists on the phone before it exists here, and creating it
 * under that same id is what makes sending the queue twice add one item rather than two.
 */
export async function addItem(
  listId: string,
  text: string,
  amount: number,
  id?: string,
): Promise<AddOutcome> {
  if (id && (await prisma.listItem.findUnique({ where: { id }, select: { id: true } }))) {
    // The row is already here: this is the second arrival of one send, not a second item.
    return { ok: true };
  }

  const existing = await prisma.listItem.findFirst({
    where: { listId, text: { equals: text, mode: "insensitive" } },
    orderBy: { done: "desc" },
  });

  if (existing?.done) {
    await restoreItem(existing.id, listId, amount);
    return { ok: true };
  }
  if (existing) return { ok: false, clash: existing.text };

  await prisma.listItem.create({
    data: { ...(id ? { id } : {}), listId, text, amount, position: await nextPosition(listId) },
  });
  return { ok: true };
}

/** How many of an item are wanted. Absolute, like everything else here. */
export async function setItemAmount(itemId: string, amount: number) {
  await prisma.listItem.update({ where: { id: itemId }, data: { amount } });
}

/** What an item is called. Blank text is not a state this writes; callers refuse it first. */
export async function setItemText(itemId: string, text: string) {
  await prisma.listItem.update({ where: { id: itemId }, data: { text } });
}
