import type { OfflineOp } from "@/lib/offline-ops";

/**
 * The changes this browser has made and not yet managed to send, kept where a reload
 * cannot lose them.
 *
 * IndexedDB rather than `localStorage` because this is the one thing in the app that must
 * survive the page being killed: a phone in a shop with no signal backgrounds the tab
 * when the camera opens, and the ticks made in the last aisle are not a cache — they are
 * what the household did.
 *
 * Every write announces itself on `window` (`QUEUE_EVENT`). The add box and the rows are
 * separate components that cannot see each other, and a row typed into one has to appear
 * in the other: an event is how the queue stays the single thing both of them read.
 */

const DB_NAME = "homehub-offline";
const DB_VERSION = 1;
const STORE = "ops";

export const QUEUE_EVENT = "homehub:queue";

/**
 * Where the queue goes when there is no IndexedDB to put it in — a private window, a
 * browser that refuses it, or the server rendering this module's importers.
 *
 * Losing durability is not the same as losing the feature: the ticks still show, still
 * queue and still send the moment the connection is back. They only stop surviving a
 * reload, which is the difference between a browser that told us so and one that we
 * broke.
 */
const memory = new Map<string, OfflineOp>();
let useMemory = typeof indexedDB === "undefined";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Adds an op to the queue, keeping the order it was made in. */
export async function queueOp(op: OfflineOp): Promise<void> {
  if (!useMemory) {
    try {
      await withStore("readwrite", (store) => store.put(op));
      announce();
      return;
    } catch {
      // One failure is enough: a browser that refuses the database once will refuse it
      // again, and retrying on every tick would cost a promise per press for nothing.
      useMemory = true;
    }
  }

  memory.set(op.id, op);
  announce();
}

/**
 * Everything waiting, oldest first.
 *
 * The order matters and is the order the ops were made: two ticks on the same row send
 * as two ops, and the last one is what the household meant.
 */
export async function queuedOps(): Promise<OfflineOp[]> {
  if (!useMemory) {
    try {
      const rows = await withStore<OfflineOp[]>("readonly", (store) => store.getAll());
      return rows;
    } catch {
      useMemory = true;
    }
  }

  return [...memory.values()];
}

/** Forgets ops by id — the ones the server has taken, and the ones it has refused. */
export async function dropOps(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  if (!useMemory) {
    try {
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE, "readwrite");
          const store = transaction.objectStore(STORE);
          for (const id of ids) store.delete(id);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
      announce();
      return;
    } catch {
      useMemory = true;
    }
  }

  for (const id of ids) memory.delete(id);
  announce();
}

/**
 * Empties the queue, which is what logging out means: the ops belong to the session that
 * made them, and replaying somebody else's shopping into the home they have just been
 * handed the browser for is worse than losing a tick.
 */
export async function clearQueue(): Promise<void> {
  memory.clear();
  if (!useMemory) {
    try {
      await withStore("readwrite", (store) => store.clear());
    } catch {
      useMemory = true;
    }
  }
  announce();
}

/** A new row's id, chosen here so the server can create the row with it — see OfflineOp. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
