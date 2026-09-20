import { z } from "zod";
import { MAX_AMOUNT, MIN_AMOUNT } from "@/lib/amount";

/**
 * A change made to a list while the connection was gone, waiting to be sent.
 *
 * **Every op says what the row should end up as, never what to do to it.** A tick
 * carries `done: true` rather than "flip", and an amount carries the number rather than
 * a step. That is the whole reason a queue can be replayed safely: sending the same op
 * twice — after a reply that never arrived, or a browser that flushed and then flushed
 * again — lands on the same row it landed on the first time. A queue of increments and
 * flips has to be sent exactly once, which is a promise no phone in a supermarket can
 * keep.
 *
 * `itemId` on an add is chosen by the browser rather than by the database, for the same
 * reason: the row can then be created with that id, so a replay finds it already there
 * instead of adding a second one.
 *
 * What is *not* here is as deliberate. A drag and a delete stay online-only: both are
 * kitchen-table edits rather than things done in an aisle, and both would need a rule
 * for what happens when two phones disagree about an order or about a row one of them
 * has already removed. An op kind is not free — it is another way for two people in the
 * same home to mean different things by the same list.
 */
export type OfflineOp =
  | { id: string; kind: "tick"; listId: string; itemId: string; done: boolean }
  | { id: string; kind: "add"; listId: string; itemId: string; text: string; amount: number }
  | { id: string; kind: "amount"; listId: string; itemId: string; amount: number };

export type OpKind = OfflineOp["kind"];

/** How many ops one request may carry. A shop is dozens of ticks, never thousands. */
export const MAX_OPS = 200;

/**
 * The longest a list item's text may be, here and in `addListItem` both — imported by
 * the action rather than repeated there, because the two disagreeing would mean a line
 * accepted at the kitchen table and refused in the aisle.
 */
export const MAX_ITEM_TEXT = 500;

const id = z.string().min(1).max(64);
const amount = z.number().int().min(MIN_AMOUNT).max(MAX_AMOUNT);

const opSchema = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("tick"), listId: id, itemId: id, done: z.boolean() }),
  z.object({
    id,
    kind: z.literal("add"),
    listId: id,
    itemId: id,
    text: z.string().min(1).max(MAX_ITEM_TEXT),
    amount,
  }),
  z.object({ id, kind: z.literal("amount"), listId: id, itemId: id, amount }),
]);

export const opsSchema = z.object({ ops: z.array(opSchema).max(MAX_OPS) });

/**
 * The ops in a request body, or null if it is not a batch of them.
 *
 * The queue is written by this app's own code, but it arrives over the network like
 * anything else — and it arrives from a browser that may have been offline across a
 * deploy, so it can be a shape this version has never written.
 */
export function readOps(body: unknown): OfflineOp[] | null {
  const parsed = opsSchema.safeParse(body);
  return parsed.success ? parsed.data.ops : null;
}

/** A recipe that asked for an item, as the row names it. */
export type Source = { id: string; title: string };

/** Somebody in this home, as a ticked row names them. */
export type Person = { id: string; name: string; photoId: string | null };

/**
 * One row of a list, as the page draws it and as the overlay rebuilds it.
 *
 * Defined here rather than in the component because the overlay has to be able to make
 * one: an item added with no connection exists nowhere else until the queue is sent, so
 * this module writes the row itself, and a shape declared in two places is a row that
 * eventually differs between the two.
 */
export type ListRow = {
  id: string;
  text: string;
  amount: number;
  done: boolean;
  position: number;
  /** The recipes this item came from, or nothing at all if it was typed in by hand. */
  sources: Source[];
  /** Who ticked it off, on a ticked row; nobody on one still open. */
  completedBy: Person | null;
};

/**
 * The list as it stands, once the changes nobody has been able to send yet are laid over
 * what the server last said.
 *
 * This is what makes a reload in a shop show the shopping rather than the shopping from
 * before the signal went. The page's own rows come from the server — which, offline, is
 * whatever the service worker kept — and every queued op is applied on top, in the order
 * it was made.
 *
 * An op naming a row that is not here is ignored rather than dropped: the row may have
 * been deleted from another phone, in which case there is nothing to show, and the
 * server will say the same thing about the op when it eventually arrives.
 */
export function applyPending(items: ListRow[], ops: OfflineOp[], by: Person): ListRow[] {
  let next = items;

  for (const op of ops) {
    if (op.kind === "add") {
      const existing = next.find((item) => item.id === op.itemId);
      // Already on the page: the op was sent, the row came back, and this is simply a
      // queue that has not been tidied yet.
      if (existing) continue;

      const last = next.reduce((furthest, item) => Math.max(furthest, item.position), 0);
      next = [
        ...next,
        {
          id: op.itemId,
          text: op.text,
          amount: op.amount,
          done: false,
          position: last + 1,
          sources: [],
          completedBy: null,
        },
      ];
      continue;
    }

    next = next.map((item) => {
      if (item.id !== op.itemId) return item;
      if (op.kind === "amount") return { ...item, amount: op.amount };
      // Ticking off drops the recipes that put it there, resets the amount to one and
      // names whoever pressed it, exactly as the server will when the op arrives — see
      // `setItemDone`.
      return {
        ...item,
        done: op.done,
        amount: op.done ? MIN_AMOUNT : item.amount,
        sources: op.done ? [] : item.sources,
        completedBy: op.done ? by : null,
      };
    });
  }

  return next;
}

/**
 * Whether the server already says what this op was asking for — which is when the op has
 * nothing left to do and can be forgotten.
 *
 * It is how the queue empties itself: rather than trusting a reply and deleting, the
 * client asks the next thing the server sends whether the change is in it. An op somebody
 * else in the home happened to make first is satisfied the same way, which is correct —
 * the item is ticked off, and who did it is not what the queue was for.
 */
export function isSettled(items: ListRow[], op: OfflineOp): boolean {
  const item = items.find((row) => row.id === op.itemId);

  if (op.kind === "add") return item !== undefined;
  // A row that is no longer there cannot be made to say anything, so the op is spent.
  if (!item) return true;
  if (op.kind === "amount") return item.amount === op.amount;
  return item.done === op.done;
}

/**
 * The one line a list says about the connection, or nothing at all.
 *
 * Here rather than in the component that draws it because it is the only part of this
 * with a right answer: silence when there is a connection and nothing waiting, a count
 * when there is something, and never a sentence claiming a change was saved anywhere it
 * was not.
 */
export function statusLine(online: boolean, waiting: number, sending: boolean): string | null {
  if (!online) {
    return waiting > 0
      ? `Offline — ${changes(waiting)} saved on this phone, and sent when you are back.`
      : "Offline — ticks are saved here and sent when you are back.";
  }
  // Sending says what is happening; a count of what is left says it more precisely, and
  // between the two there is nothing to report.
  if (waiting > 0) return sending ? `Sending ${changes(waiting)}…` : `${changes(waiting)} to send.`;
  return null;
}

function changes(count: number) {
  return `${count} change${count === 1 ? "" : "s"}`;
}
