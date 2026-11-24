import { describe, expect, it } from "vitest";
import { listTile, readTiles, setTile, TILE_SLOTS, tileListId } from "@/lib/dashboard-tiles";

describe("readTiles", () => {
  it("leaves every place empty for somebody who never chose — nothing is picked for them", () => {
    expect(readTiles([])).toEqual([null, null, null]);
    expect(readTiles(null)).toEqual([null, null, null]);
  });

  it("keeps a choice in the place it was made, empty places included", () => {
    expect(readTiles(["", "feed", "sleep"])).toEqual([null, "feed", "sleep"]);
    expect(readTiles(["recipe", "list:abc"])).toEqual(["recipe", "list:abc", null]);
  });

  it("empties a place holding something unknown, a repeat, or one of the old numbers", () => {
    expect(readTiles(["due", "sleep", "sleep"])).toEqual([null, "sleep", null]);
    expect(readTiles(["toBuy", "runOut", 7])).toEqual([null, null, null]);
    expect(readTiles(["list:"])).toEqual([null, null, null]);
  });

  it("empties a list this home does not have, and keeps one it does", () => {
    const here = new Set(["a"]);
    expect(readTiles(["list:a", "list:b", "feed"], here)).toEqual(["list:a", null, "feed"]);
  });

  it("always answers exactly the dashboard's places", () => {
    for (const stored of [[], ["sleep"], ["sleep", "feed", "recipe", "list:x"]]) {
      expect(readTiles(stored)).toHaveLength(TILE_SLOTS);
    }
  });
});

describe("setTile", () => {
  it("fills a place, and empties one", () => {
    expect(setTile([null, null, null], 1, "sleep")).toEqual([null, "sleep", null]);
    expect(setTile([null, "sleep", null], 1, null)).toEqual([null, null, null]);
  });

  it("swaps a choice already elsewhere rather than drawing it twice", () => {
    expect(setTile(["sleep", "feed", null], 2, "sleep")).toEqual([null, "feed", "sleep"]);
    expect(setTile(["sleep", "feed", null], 0, "feed")).toEqual(["feed", "sleep", null]);
  });

  it("ignores a place that is not there", () => {
    expect(setTile([null, null, null], 3, "sleep")).toEqual([null, null, null]);
  });
});

describe("a list as a tile", () => {
  it("is written and read back by its id", () => {
    expect(tileListId(listTile("abc"))).toBe("abc");
    expect(tileListId("sleep")).toBeNull();
  });
});
