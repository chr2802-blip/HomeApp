"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QUEUE_EVENT, dropOps, queueOp, queuedOps } from "@/lib/offline-queue";
import { isSettled, type ListRow, type OfflineOp } from "@/lib/offline-ops";

/** What happened to a change: run against the server, or kept for when there is one. */
export type Recorded<T> = { sent: true; result: T } | { sent: false };

/**
 * A network failure, as opposed to something the server said no to.
 *
 * `fetch` rejects with a TypeError when the request never reached anybody, which is what
 * a server action's call does too — everything else that comes back out of an action is
 * the server having answered, and must not be mistaken for an aisle with no signal.
 */
function isOffline(error: unknown) {
  return error instanceof TypeError;
}

let flushing: Promise<OfflineOp[]> | null = null;

/**
 * Sends everything waiting, once, however many rows on the page ask at the same time.
 *
 * The queue is one thing shared by every component reading it, so the send has to be one
 * thing too: two flushes in flight would each send the same ops, and while that is
 * harmless — every op says what the row should end up as, not what to do to it — it is
 * twice the work and twice the writes for one reconnection.
 *
 * Returns the ops the server took. A request that fails as a whole returns nothing and
 * **leaves the queue exactly as it was**: the changes are still the household's, and the
 * next reconnection or visit will try again. Only ops the server has either applied or
 * refused are dropped, because those are the two ways an op is finished with.
 */
export function flushQueue(): Promise<OfflineOp[]> {
  flushing ??= send().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function send(): Promise<OfflineOp[]> {
  const ops = await queuedOps();
  if (ops.length === 0) return [];

  let body: { applied?: unknown; rejected?: unknown };
  try {
    const response = await fetch("/api/lists/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ops }),
      // The queue is the point of this request; an answer from the browser's cache would
      // be an answer to somebody else's.
      cache: "no-store",
    });
    if (!response.ok) return [];
    body = await response.json();
  } catch {
    return [];
  }

  const applied = new Set(asIds(body.applied));
  const rejected = asRejectedIds(body.rejected);
  await dropOps([...applied, ...rejected]);

  return ops.filter((op) => applied.has(op.id));
}

function asIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function asRejectedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (row && typeof row === "object" ? (row as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string");
}

/**
 * The list's unsent changes, and the way to make one.
 *
 * Three things are kept apart here, and the difference between them is the whole design:
 *
 * - **queued** ops, in IndexedDB, are changes nobody has managed to send. They are what
 *   the rows are drawn from on top of what the server last said, so a reload in a shop
 *   shows the shopping rather than the shopping as it was before the signal went.
 * - **held** ops are ones the server has just taken. They are gone from the queue, so
 *   nothing can send them twice, but they stay in front of the rows until the page has
 *   been re-rendered with them in it — otherwise a reconnection would show the ticks
 *   flicking off and on again while the refresh is in flight.
 * - anything the server has already agreed with is neither, and `reconcile` drops it. A
 *   queue does not empty itself by trusting a reply; it empties itself by asking the next
 *   thing the server sends whether the change is in it, which is also how an op somebody
 *   else in the home made first quietly disappears.
 */
/**
 * Sends the queue whenever there is a chance it will go through, and says what went.
 *
 * Used by the list's own rows and by the app's shell alike: a tick made in a shop has to
 * leave this phone on the first reconnection, and a household that came back to the app on
 * the dashboard must not have to open a list before their shopping is sent.
 *
 * `online` is the event that matters, and the other two are the ones that catch what it
 * misses: a tab that was asleep when the signal came back never hears it, and a browser
 * that believes it is online while the train is in a tunnel only finds out when something
 * is actually sent. Nothing is on a timer — a queue with nothing in it sends nothing, so
 * all three are free.
 */
export function useQueueFlush(
  options: {
    onSending?: (sending: boolean) => void;
    onApplied?: (ops: OfflineOp[]) => void;
    onOnline?: () => void;
    onOffline?: () => void;
  } = {},
) {
  const router = useRouter();
  const { onSending, onApplied, onOnline, onOffline } = options;

  const flush = useCallback(async () => {
    onSending?.(true);
    try {
      const applied = await flushQueue();
      onApplied?.(applied);
      // Only where something moved: a refresh per wake-up on a queue that is already empty
      // is a request per tab per tunnel.
      if (applied.length > 0) router.refresh();
    } finally {
      onSending?.(false);
    }
  }, [onApplied, onSending, router]);

  useEffect(() => {
    const wentOnline = () => {
      onOnline?.();
      void flush();
    };
    const wentOffline = () => onOffline?.();
    const cameBack = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void flush();
    };

    void flush();
    window.addEventListener("online", wentOnline);
    window.addEventListener("offline", wentOffline);
    document.addEventListener("visibilitychange", cameBack);
    return () => {
      window.removeEventListener("online", wentOnline);
      window.removeEventListener("offline", wentOffline);
      document.removeEventListener("visibilitychange", cameBack);
    };
  }, [flush, onOnline, onOffline]);
}

export function useOfflineList(listId: string) {
  const [queued, setQueued] = useState<OfflineOp[]>([]);
  const [held, setHeld] = useState<OfflineOp[]>([]);
  const [online, setOnline] = useState(true);
  const [sending, setSending] = useState(false);

  const reread = useCallback(async () => {
    setQueued(await queuedOps());
  }, []);

  // Every write to the queue announces itself, because the add box and the rows are
  // separate components with no way to tell each other that a row now exists.
  useEffect(() => {
    void reread();
    window.addEventListener(QUEUE_EVENT, reread);
    return () => window.removeEventListener(QUEUE_EVENT, reread);
  }, [reread]);

  /*
   * What the rows do with a send: whatever went is held in front of them until the page has
   * been re-rendered with it, and whatever is left is re-read from the queue.
   *
   * A send that carried nothing says nothing about the connection — it is also what a
   * failed request looks like from here, and a page rebuilt from the worker's copy in a
   * shop flushes on mount and fails. Claiming to be online there would put the one line
   * saying where the ticks went back in the drawer.
   */
  const onApplied = useCallback(
    (applied: OfflineOp[]) => {
      if (applied.length === 0) return;

      setOnline(true);
      setHeld((current) => [...current, ...applied]);
      void reread();
    },
    [reread],
  );

  const onOnline = useCallback(() => setOnline(true), []);
  const onOffline = useCallback(() => setOnline(false), []);

  // What the browser believes on arrival; the events keep it honest from there, and a
  // request that never lands corrects it from the other direction — see `record`.
  useEffect(() => setOnline(navigator.onLine), []);
  useQueueFlush({ onSending: setSending, onApplied, onOnline, onOffline });

  /**
   * Makes a change, against the server where there is one and against the queue where
   * there is not.
   *
   * The optimistic update on the page has already happened by the time this is called —
   * that is the press being answered, and it must not wait for a round trip. What this
   * decides is only where the change is *kept*: sent now, or written down so that the
   * page keeps showing it after React has dropped the optimistic copy.
   */
  const record = useCallback(
    async <T,>(ops: OfflineOp[], send: () => Promise<T>): Promise<Recorded<T>> => {
      if (navigator.onLine) {
        try {
          return { sent: true, result: await send() };
        } catch (error) {
          // A server that answered with a refusal is not this function's business; only a
          // request that never arrived becomes something to keep.
          if (!isOffline(error)) throw error;
          setOnline(false);
        }
      }

      // Into the page's own state before the database, so the row never blinks: React
      // discards its optimistic copy the moment the form action settles, which is a
      // moment sooner than a write to IndexedDB can come back.
      setQueued((current) => [...current, ...ops]);
      for (const op of ops) await queueOp(op);
      return { sent: false };
    },
    [],
  );

  /**
   * Runs something the queue has no op for — a removal, a drag — and says nothing when
   * there is no connection to run it against.
   *
   * Both are edits made at a kitchen table rather than in an aisle, and both would need a
   * rule for what two phones disagreeing about an order or about an already-deleted row
   * means. Left online-only, the optimistic change simply comes back when the action
   * fails, which reads as what it is: not now.
   */
  const onlyOnline = useCallback(async (send: () => Promise<unknown>) => {
    try {
      await send();
    } catch (error) {
      if (!isOffline(error)) throw error;
      setOnline(false);
    }
  }, []);

  /** Drops the ops the given rows already agree with. */
  const reconcile = useCallback((items: ListRow[]) => {
    setHeld((current) => current.filter((op) => !isSettled(items, op)));
    void (async () => {
      const settled = (await queuedOps()).filter((op) => isSettled(items, op));
      if (settled.length > 0) await dropOps(settled.map((op) => op.id));
    })();
  }, []);

  const pending = useMemo(
    () => [...held, ...queued].filter((op) => op.listId === listId),
    [held, queued, listId],
  );

  return { pending, record, onlyOnline, reconcile, online, sending };
}
