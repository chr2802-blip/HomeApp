import { describe, expect, it } from "vitest";
import { listVersion, type VersionedList } from "@/lib/list-version";

const item = (overrides: Partial<VersionedList["items"][number]> = {}) => ({
  id: "a",
  text: "Milk",
  amount: 1,
  done: false,
  position: 1,
  completedById: null,
  sourceIds: [],
  ...overrides,
});

const list = (items: VersionedList["items"], overrides: Partial<VersionedList> = {}) => ({
  title: "Shopping",
  trackAmounts: true,
  photoId: null,
  items,
  ...overrides,
});

describe("listVersion", () => {
  const base = listVersion(list([item(), item({ id: "b", text: "Bread", position: 2 })]));

  it("is short and stable", () => {
    expect(base).toMatch(/^[0-9a-f]{8}$/);
    expect(listVersion(list([item(), item({ id: "b", text: "Bread", position: 2 })]))).toBe(base);
  });

  it("does not depend on the order the rows arrived in", () => {
    expect(listVersion(list([item({ id: "b", text: "Bread", position: 2 }), item()]))).toBe(base);
  });

  // Every field the page draws is a change the other phone has to see.
  it.each([
    ["a tick", { done: true, completedById: "u1" }],
    ["who ticked it", { completedById: "u2" }],
    ["a rename", { text: "Oat milk" }],
    ["an amount", { amount: 3 }],
    ["a move", { position: 5 }],
    ["a recipe note", { sourceIds: ["r1"] }],
  ])("changes with %s", (_label, change) => {
    expect(listVersion(list([item(change), item({ id: "b", text: "Bread", position: 2 })]))).not.toBe(
      base,
    );
  });

  it("changes when a row is added or removed", () => {
    expect(listVersion(list([item()]))).not.toBe(base);
    expect(
      listVersion(
        list([item(), item({ id: "b", text: "Bread", position: 2 }), item({ id: "c", text: "Eggs" })]),
      ),
    ).not.toBe(base);
  });

  it("changes with the list's own title, amounts setting and picture", () => {
    const items = [item(), item({ id: "b", text: "Bread", position: 2 })];
    expect(listVersion(list(items, { title: "Weekend" }))).not.toBe(base);
    expect(listVersion(list(items, { trackAmounts: false }))).not.toBe(base);
    expect(listVersion(list(items, { photoId: "p1" }))).not.toBe(base);
  });
});
