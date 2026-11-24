/**
 * The three tiles under the dashboard's greeting, and which three a person keeps there.
 *
 * Each place holds one choice (`User.dashboardTiles`, in order): one of the fixed kinds
 * below, or a list of this home's, written `list:<id>`. Plain data with no JSX, so the
 * rules are unit-tested and the tiles themselves stay in `src/components/dashboard-tiles.tsx`.
 *
 * A person's, not a home's — like the tab bar's pins, it is their thumb. A list belongs to
 * one home, so in another home that choice names nothing and the place reads as empty,
 * rather than drawing a tile that leads nowhere.
 */

/** The kinds of tile that are not a particular list, in the order the chooser offers them. */
export const TILE_KINDS = ["sleep", "feed", "recipe"] as const;
export type TileKind = (typeof TILE_KINDS)[number];

/** A tile choice: a fixed kind, or one list. */
export type TileChoice = TileKind | `list:${string}`;

/** One place on the dashboard: a choice, or null for a place nobody has filled yet. */
export type TileSlot = TileChoice | null;

/** How many tiles the dashboard draws. */
export const TILE_SLOTS = 3;

/** The form field the choices arrive in, once per place, in order — empty for an empty place. */
export const TILE_FIELD = "tile";

const LIST_PREFIX = "list:";

/** The list a choice names, or null for a fixed kind. */
export function tileListId(choice: TileChoice): string | null {
  return choice.startsWith(LIST_PREFIX) ? choice.slice(LIST_PREFIX.length) : null;
}

export function listTile(listId: string): TileChoice {
  return `${LIST_PREFIX}${listId}`;
}

function isKind(value: string): value is TileKind {
  return (TILE_KINDS as readonly string[]).includes(value);
}

/** Whether a stored value is a choice at all — a known kind, or a list with an id. */
export function isTileChoice(value: unknown): value is TileChoice {
  if (typeof value !== "string") return false;
  if (isKind(value)) return true;
  return value.startsWith(LIST_PREFIX) && value.length > LIST_PREFIX.length && value.length < 64;
}

/**
 * The tiles as stored, made into exactly `TILE_SLOTS` places. **Nothing is chosen on the
 * person's behalf**: a place holding anything unknown, a repeat, or a list not in
 * `listIds` (deleted, or another home's) is empty, and so is a place never filled — the
 * dashboard draws an empty place as one saying how to fill it. Places keep their
 * positions, so emptying the first does not move the other two along. Without `listIds`
 * every well-formed list is kept — which is what the action stores, since the home it is
 * read in may be a different one next time.
 */
export function readTiles(
  stored: readonly unknown[] | null | undefined,
  listIds?: ReadonlySet<string>,
): TileSlot[] {
  const tiles: TileSlot[] = [];
  for (let slot = 0; slot < TILE_SLOTS; slot++) {
    const value = stored?.[slot];
    if (!isTileChoice(value) || tiles.includes(value)) {
      tiles.push(null);
      continue;
    }
    const list = tileListId(value);
    tiles.push(list && listIds && !listIds.has(list) ? null : value);
  }
  return tiles;
}

/**
 * `choice` put in place `slot`, or the place emptied when `choice` is null. A choice
 * already elsewhere on the dashboard swaps places with what was here, so the three stay
 * distinct and nothing quietly disappears.
 */
export function setTile(tiles: readonly TileSlot[], slot: number, choice: TileSlot): TileSlot[] {
  const next = [...tiles];
  if (slot < 0 || slot >= next.length) return next;
  const already = choice === null ? -1 : next.indexOf(choice);
  if (already === slot) return next;
  if (already >= 0) next[already] = next[slot]!;
  next[slot] = choice;
  return next;
}
