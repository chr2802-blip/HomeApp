/**
 * The row of tiles at the top of the baby log, and the order a person keeps them in.
 *
 * One tile per thing written down — sleep, each way of feeding, nappies — each saying how
 * long since the last one, with its own "+" to write the next. The order is
 * `User.babyTiles`: a person's, not a home's, like the tab bar's pins, because it is their
 * thumb that reaches for the first tile. Which tiles are drawn at all is the home's
 * (`Baby.track*`); the order only says where each one sits when it is.
 */

/** Every tile, in the order a person who never dragged one sees them. */
export const BABY_TILES = ["sleep", "breast", "bottle", "solid", "diaper"] as const;
export type BabyTile = (typeof BABY_TILES)[number];

/** The form field the order arrives in, once per tile, first first. */
export const BABY_TILE_FIELD = "tile";

export function isBabyTile(value: unknown): value is BabyTile {
  return typeof value === "string" && (BABY_TILES as readonly string[]).includes(value);
}

/**
 * The tiles as stored, made into the whole row: anything unknown or repeated is dropped,
 * and a tile the person never placed (stored empty, or added to the app since) follows
 * the ones they did, in the default order. So the row always has every tile exactly once.
 */
export function readBabyTiles(stored: readonly unknown[] | null | undefined): BabyTile[] {
  const tiles: BabyTile[] = [];
  for (const value of stored ?? []) {
    if (isBabyTile(value) && !tiles.includes(value)) tiles.push(value);
  }
  for (const tile of BABY_TILES) {
    if (!tiles.includes(tile)) tiles.push(tile);
  }
  return tiles;
}

/** The row with `moved` put where `over` is — the drag's one sentence. */
export function moveBabyTile(tiles: readonly BabyTile[], moved: BabyTile, over: BabyTile): BabyTile[] {
  const from = tiles.indexOf(moved);
  const to = tiles.indexOf(over);
  if (from < 0 || to < 0 || from === to) return [...tiles];
  const next = [...tiles];
  next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
