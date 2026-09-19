import { describe, expect, it } from "vitest";
import {
  MAX_OPS,
  applyPending,
  isSettled,
  readOps,
  statusLine,
  type ListRow,
  type OfflineOp,
} from "@/lib/offline-ops";

const me = { id: "u1", name: "Mo", photoId: null };
const other = { id: "u2", name: "Ada", photoId: null };

function row(overrides: Partial<ListRow> & { id: string }): ListRow {
  return {
    text: overrides.id,
    amount: 1,
    done: false,
    position: 1,
    sources: [],
    completedBy: null,
    ...overrides,
  };
}

const tick = (itemId: string, done: boolean): OfflineOp => ({
  id: `op-${itemId}-${done}`,
  kind: "tick",
  listId: "l1",
  itemId,
  done,
});

describe("applyPending", () => {
  it("leaves the list alone when nothing is waiting", () => {
    const items = [row({ id: "a" }), row({ id: "b" })];
    expect(applyPending(items, [], me)).toEqual(items);
  });

  it("ticks a row off, and says who did it", () => {
    const [ticked] = applyPending([row({ id: "a" })], [tick("a", true)], me);

    expect(ticked).toMatchObject({ done: true, completedBy: me });
  });

  it("drops the recipes that put an item there, as the server will", () => {
    const items = [row({ id: "a", sources: [{ id: "r1", title: "Lasagne" }] })];

    expect(applyPending(items, [tick("a", true)], me)[0]!.sources).toEqual([]);
  });

  it("brings a row back with nobody's name on it, and keeps its recipe note", () => {
    const items = [
      row({ id: "a", done: true, completedBy: other, sources: [{ id: "r1", title: "Lasagne" }] }),
    ];

    const [back] = applyPending(items, [tick("a", false)], me);
    expect(back).toMatchObject({ done: false, completedBy: null });
    expect(back!.sources).toEqual([{ id: "r1", title: "Lasagne" }]);
  });

  it("applies ops in the order they were made, so the last one wins", () => {
    const items = [row({ id: "a" })];

    expect(applyPending(items, [tick("a", true), tick("a", false)], me)[0]!.done).toBe(false);
    expect(applyPending(items, [tick("a", false), tick("a", true)], me)[0]!.done).toBe(true);
  });

  it("adds a row that exists nowhere else yet, at the end of the list", () => {
    const items = [row({ id: "a", position: 4 })];
    const add: OfflineOp = {
      id: "op1",
      kind: "add",
      listId: "l1",
      itemId: "new",
      text: "Bin bags",
      amount: 2,
    };

    const next = applyPending(items, [add], me);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      id: "new",
      text: "Bin bags",
      amount: 2,
      done: false,
      position: 5,
      sources: [],
      completedBy: null,
    });
  });

  it("does not add a row the server has already sent back", () => {
    // The op has been applied and the queue simply has not been tidied yet. Adding it
    // again would show the item twice on the one page that has it right.
    const items = [row({ id: "new", text: "Bin bags" })];
    const add: OfflineOp = {
      id: "op1",
      kind: "add",
      listId: "l1",
      itemId: "new",
      text: "Bin bags",
      amount: 1,
    };

    expect(applyPending(items, [add], me)).toHaveLength(1);
  });

  it("sets an amount, and ignores an op about a row that is gone", () => {
    const amount: OfflineOp = {
      id: "op1",
      kind: "amount",
      listId: "l1",
      itemId: "a",
      amount: 7,
    };

    expect(applyPending([row({ id: "a" })], [amount], me)[0]!.amount).toBe(7);
    expect(applyPending([row({ id: "b" })], [amount], me)).toEqual([row({ id: "b" })]);
  });

  it("does not change the rows it was given", () => {
    const items = [row({ id: "a" })];
    applyPending(items, [tick("a", true)], me);

    expect(items[0]!.done).toBe(false);
  });
});

describe("isSettled", () => {
  it("is true once the server says what the op was asking for", () => {
    expect(isSettled([row({ id: "a", done: true })], tick("a", true))).toBe(true);
    expect(isSettled([row({ id: "a" })], tick("a", true))).toBe(false);
  });

  it("is true whoever made it happen", () => {
    // Somebody else in the home ticked it off first. The item is off the list, which is
    // all the op was for — who did it is not.
    expect(isSettled([row({ id: "a", done: true, completedBy: other })], tick("a", true))).toBe(
      true,
    );
  });

  it("is true of an op about a row that no longer exists", () => {
    expect(isSettled([], tick("a", true))).toBe(true);
  });

  it("is true of an add once the row is there, whatever it says", () => {
    const add: OfflineOp = {
      id: "op1",
      kind: "add",
      listId: "l1",
      itemId: "new",
      text: "Bin bags",
      amount: 1,
    };

    expect(isSettled([], add)).toBe(false);
    expect(isSettled([row({ id: "new", done: true })], add)).toBe(true);
  });

  it("compares an amount against the number, not the row", () => {
    const amount: OfflineOp = { id: "op1", kind: "amount", listId: "l1", itemId: "a", amount: 7 };

    expect(isSettled([row({ id: "a", amount: 7 })], amount)).toBe(true);
    expect(isSettled([row({ id: "a", amount: 2 })], amount)).toBe(false);
  });
});

describe("readOps", () => {
  const good = { ops: [tick("a", true)] };

  it("reads a batch this app wrote", () => {
    expect(readOps(good)).toEqual(good.ops);
  });

  it("reads an empty batch, which is what a browser with nothing waiting sends", () => {
    expect(readOps({ ops: [] })).toEqual([]);
  });

  it("refuses anything that is not a batch of ops", () => {
    expect(readOps(null)).toBeNull();
    expect(readOps({})).toBeNull();
    expect(readOps({ ops: "everything" })).toBeNull();
    expect(readOps({ ops: [{ kind: "drop-database", listId: "l1" }] })).toBeNull();
  });

  it("refuses an op missing the state it is meant to land in", () => {
    // Without it there is nothing to replay: "flip this" cannot be sent twice.
    expect(readOps({ ops: [{ id: "o", kind: "tick", listId: "l", itemId: "i" }] })).toBeNull();
  });

  it("refuses an amount outside what the pickers can ask for", () => {
    const op = { id: "o", kind: "amount", listId: "l", itemId: "i" };
    expect(readOps({ ops: [{ ...op, amount: 0 }] })).toBeNull();
    expect(readOps({ ops: [{ ...op, amount: 1000 }] })).toBeNull();
    expect(readOps({ ops: [{ ...op, amount: 1.5 }] })).toBeNull();
  });

  it("refuses a batch longer than one shop could possibly be", () => {
    const ops = Array.from({ length: MAX_OPS + 1 }, (_, index) => tick(`a${index}`, true));
    expect(readOps({ ops })).toBeNull();
    expect(readOps({ ops: ops.slice(0, MAX_OPS) })).toHaveLength(MAX_OPS);
  });
});

describe("statusLine", () => {
  it("says nothing at all when the connection is there and nothing is waiting", () => {
    expect(statusLine(true, 0, false)).toBeNull();
  });

  it("says what is being kept when there is no connection", () => {
    expect(statusLine(false, 0, false)).toMatch(/^Offline/);
    expect(statusLine(false, 1, false)).toContain("1 change");
    expect(statusLine(false, 3, false)).toContain("3 changes");
  });

  it("says what is happening once there is a connection again", () => {
    expect(statusLine(true, 2, true)).toBe("Sending 2 changes…");
    expect(statusLine(true, 2, false)).toBe("2 changes to send.");
  });
});
