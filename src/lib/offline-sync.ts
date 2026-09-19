import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canAccessHome } from "@/lib/access";
import type { SessionUser } from "@/lib/auth";
import { addItem, setItemAmount, setItemDone } from "@/lib/list-writes";
import type { OfflineOp } from "@/lib/offline-ops";

/**
 * What the app does with a queue of changes made while the phone had no signal.
 *
 * Every op is applied with the same functions the actions use, so a tick that waited in
 * an aisle for twenty minutes means exactly what a tick pressed at the kitchen table
 * means — including counting the week when it is the tick that empties a list.
 *
 * An op the caller may not make, or that no longer has anything to act on, comes back as
 * **rejected** rather than thrown. That distinction is the whole contract with the
 * browser: an op that was applied and an op that can never be applied are both finished
 * with and must leave the queue, while a request that fails as a whole — no network, a
 * deploy in progress, a 500 — must leave every op in it exactly where it was. Throwing
 * for one bad op would take the other nineteen down with it.
 *
 * The ops are applied in the order they were made, one after another rather than in
 * parallel: two ticks on the same row are two ops, and the last one is what the household
 * meant.
 */
export type SyncResult = {
  applied: string[];
  rejected: { id: string; reason: string }[];
};

export async function applyQueuedOps(
  user: SessionUser,
  ops: OfflineOp[],
): Promise<SyncResult> {
  const applied: string[] = [];
  const rejected: SyncResult["rejected"] = [];
  const touched = new Set<string>();

  for (const op of ops) {
    const outcome = await applyOne(user, op);
    if (outcome.ok) {
      applied.push(op.id);
      touched.add(op.listId);
    } else {
      rejected.push({ id: op.id, reason: outcome.reason });
    }
  }

  // Everything a tick can change, for whoever is reading this home in another tab or on
  // another device: the list's page, the bar on its card, and the streak on the
  // dashboard. The same three the actions refresh, for the same reason.
  for (const listId of touched) revalidatePath(`/lists/${listId}`);
  if (touched.size > 0) {
    revalidatePath("/lists");
    revalidatePath("/dashboard");
  }

  return { applied, rejected };
}

type OneOutcome = { ok: true } | { ok: false; reason: string };

async function applyOne(
  user: SessionUser,
  op: OfflineOp,
): Promise<OneOutcome> {
  if (op.kind === "add") {
    const list = await prisma.list.findUnique({ where: { id: op.listId } });
    // Not this caller's list, or not a list at all: indistinguishable on purpose, so a
    // queue cannot be used to ask which ids exist.
    if (!list || !canAccessHome(user, list.homeId)) return { ok: false, reason: "no such list" };

    const outcome = await addItem(op.listId, op.text, op.amount, op.itemId);
    // Already on the list and not ticked off. Nothing is going to change that later, so
    // the op is finished with rather than kept: the list already says what it was for.
    return outcome.ok ? { ok: true } : { ok: false, reason: `"${outcome.clash}" is already on the list` };
  }

  const item = await prisma.listItem.findUnique({
    where: { id: op.itemId },
    include: { list: true },
  });
  // Deleted from another phone while this one was away. The row it was about is gone, so
  // there is nothing left for the op to say.
  if (!item) return { ok: false, reason: "no such item" };
  if (!canAccessHome(user, item.list.homeId)) return { ok: false, reason: "no such item" };
  // The queue names both, and they have to agree: an item is reached through its list,
  // which is what carries the home.
  if (item.listId !== op.listId) return { ok: false, reason: "no such item" };

  if (op.kind === "amount") {
    await setItemAmount(item.id, op.amount);
    return { ok: true };
  }

  await setItemDone(item, op.done, item.list.homeId, user.id);
  return { ok: true };
}
