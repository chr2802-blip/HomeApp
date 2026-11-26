import { describe, expect, it } from "vitest";
import { BABY_TILES, moveBabyTile, readBabyTiles } from "@/lib/baby-tiles";

describe("readBabyTiles", () => {
  it("is the default order when nothing is stored", () => {
    expect(readBabyTiles([])).toEqual([...BABY_TILES]);
    expect(readBabyTiles(null)).toEqual([...BABY_TILES]);
  });

  it("keeps a person's order and appends what they never placed", () => {
    expect(readBabyTiles(["diaper", "solid"])).toEqual(["diaper", "solid", "sleep", "breast", "bottle"]);
  });

  it("drops what it does not know, and a repeat", () => {
    expect(readBabyTiles(["feed", "bottle", "bottle", 3, ""])).toEqual(["bottle", "sleep", "breast", "solid", "diaper"]);
  });
});

describe("moveBabyTile", () => {
  it("puts a tile where another one was", () => {
    expect(moveBabyTile([...BABY_TILES], "diaper", "sleep")).toEqual(["diaper", "sleep", "breast", "bottle", "solid"]);
    expect(moveBabyTile([...BABY_TILES], "sleep", "bottle")).toEqual(["breast", "bottle", "sleep", "solid", "diaper"]);
  });

  it("leaves the row alone for a drop on itself", () => {
    expect(moveBabyTile([...BABY_TILES], "solid", "solid")).toEqual([...BABY_TILES]);
  });
});
