import { Prisma } from "@prisma/client";
import type { HomeTheme } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * How much of the database each household — and each kind of thing in it — is using.
 *
 * The bytes of a picture live in Postgres rather than in object storage (see Photo in
 * the schema), so "how big is this home" is a real question with a real answer, and the
 * answer is almost entirely pictures. That is the point of showing it: a household
 * wondering why the app has grown is not looking for its shopping lists.
 *
 * Measured in raw SQL rather than by adding up columns in TypeScript, because the only
 * honest answer comes from Postgres itself. `pg_column_size` reports what a value
 * actually occupies — after compression, and for a picture that is the whole of it —
 * which is a number no amount of `length()` on the way past can produce.
 */

/** The kinds a home's storage divides into. The order is the order they are drawn in. */
export const STORAGE_KINDS = ["recipes", "lists", "tasks", "rest"] as const;

export type StorageKind = (typeof STORAGE_KINDS)[number];

/**
 * What each kind is called, and what it is.
 *
 * A picture counts towards the thing holding it: a recipe's photo is part of that
 * recipe, because "how much does a recipe cost us" answered without its picture is off
 * by a factor of a hundred and tells nobody anything. `rest` is what is left — the home
 * record, who is in it, who is invited, the home's own picture, the members' own
 * pictures that happen to be filed here, and uploads nothing points at yet.
 */
export const STORAGE_LABELS: Record<StorageKind, string> = {
  recipes: "Recipes",
  lists: "Lists",
  tasks: "Tasks",
  rest: "Everything else",
};

export type KindTotals = Record<StorageKind, number>;

export type HomeStorage = {
  /** Every kind, including the ones at zero: a slice missing reads as a bug. */
  kinds: KindTotals;
  total: number;
};

/** One home's share of the installation, as the super admin's page lists them. */
export type HomeShare = {
  id: string;
  name: string;
  theme: HomeTheme;
  bytes: number;
};

export type InstallationStorage = HomeStorage & {
  /** Every home, largest first. */
  homes: HomeShare[];
};

type Row = { homeId: string; kind: string; bytes: bigint | number };

function emptyTotals(): KindTotals {
  return { recipes: 0, lists: 0, tasks: 0, rest: 0 };
}

function isKind(value: string): value is StorageKind {
  return (STORAGE_KINDS as readonly string[]).includes(value);
}

/**
 * Every row in the database, priced and labelled with the home it belongs to.
 *
 * `pg_column_size` on a whole row (`t.*`) is the tuple's own size with each column
 * counted as stored. On a single column it is the same figure for that column alone,
 * and — this is why the pictures are measured column by column rather than as rows —
 * it reads the size out of the TOAST pointer instead of fetching the bytes back. A
 * `pg_column_size(p.*)` over the Photo table would pull every picture in the home
 * through the connection to weigh it, which is a page nobody would wait for. The rest
 * of a Photo row beside its two blobs is a rounding error, so it is left out.
 *
 * The scope is a `WHERE` on the union rather than a filter per branch: Postgres pushes
 * it down into each branch itself, and one copy cannot be the one that was forgotten.
 */
function breakdown(scope: Prisma.Sql) {
  return Prisma.sql`
    SELECT "homeId", kind, SUM(bytes)::bigint AS bytes
    FROM (
      SELECT r."homeId" AS "homeId", 'recipes' AS kind, pg_column_size(r.*) AS bytes
        FROM "Recipe" r
      UNION ALL
      SELECT c."homeId", 'recipes', pg_column_size(c.*) FROM "RecipeCategory" c
      UNION ALL
      SELECT r."homeId", 'recipes', pg_column_size(k.*)
        FROM "RecipeCategoryLink" k JOIN "Recipe" r ON r.id = k."recipeId"
      UNION ALL
      SELECT l."homeId", 'lists', pg_column_size(l.*) FROM "List" l
      UNION ALL
      SELECT l."homeId", 'lists', pg_column_size(i.*)
        FROM "ListItem" i JOIN "List" l ON l.id = i."listId"
      UNION ALL
      SELECT l."homeId", 'lists', pg_column_size(o.*)
        FROM "ListItemSource" o
        JOIN "ListItem" i ON i.id = o."itemId"
        JOIN "List" l ON l.id = i."listId"
      UNION ALL
      SELECT l."homeId", 'lists', pg_column_size(f.*)
        FROM "ListFavorite" f JOIN "List" l ON l.id = f."listId"
      UNION ALL
      SELECT t."homeId", 'tasks', pg_column_size(t.*) FROM "Task" t
      UNION ALL
      SELECT h.id, 'rest', pg_column_size(h.*) FROM "Home" h
      UNION ALL
      SELECT m."homeId", 'rest', pg_column_size(m.*) FROM "HomeMember" m
      UNION ALL
      SELECT v."homeId", 'rest', pg_column_size(v.*) FROM "Invite" v
      UNION ALL
      -- A picture is charged to whatever is showing it, and to the home only once:
      -- the first match wins, so a photo that somehow ended up on two things is still
      -- counted a single time.
      SELECT
        p."homeId",
        CASE
          WHEN EXISTS (SELECT 1 FROM "Recipe" r WHERE r."photoId" = p.id) THEN 'recipes'
          WHEN EXISTS (SELECT 1 FROM "List" l WHERE l."photoId" = p.id) THEN 'lists'
          WHEN EXISTS (SELECT 1 FROM "Task" t WHERE t."photoId" = p.id) THEN 'tasks'
          ELSE 'rest'
        END,
        pg_column_size(p.bytes) + pg_column_size(p."thumbBytes")
      FROM "Photo" p
    ) priced
    ${scope}
    GROUP BY "homeId", kind
  `;
}

function foldKinds(rows: Row[], into: KindTotals = emptyTotals()) {
  for (const row of rows) {
    if (isKind(row.kind)) into[row.kind] += Number(row.bytes);
  }
  return into;
}

function sum(totals: KindTotals) {
  return STORAGE_KINDS.reduce((running, kind) => running + totals[kind], 0);
}

/**
 * What one household is using, broken down by what it is using it on.
 *
 * The home is bound into the query rather than carried by `homeDb`, which scopes
 * Prisma's model calls and has nothing to say about raw SQL. It is the only parameter
 * this takes, and every branch of the union above is filtered by it.
 */
export async function getHomeStorage(homeId: string): Promise<HomeStorage> {
  const rows = await prisma.$queryRaw<Row[]>(
    breakdown(Prisma.sql`WHERE priced."homeId" = ${homeId}`),
  );

  const kinds = foldKinds(rows);
  return { kinds, total: sum(kinds) };
}

/**
 * The same question asked of the whole installation, plus each home's share of it.
 *
 * Crossing homes is the point here — this is the super admin's system view — so it
 * goes through `prisma` directly and names no home at all.
 */
export async function getInstallationStorage(): Promise<InstallationStorage> {
  const [rows, homes] = await Promise.all([
    prisma.$queryRaw<Row[]>(breakdown(Prisma.empty)),
    prisma.home.findMany({ select: { id: true, name: true, theme: true } }),
  ]);

  const perHome = new Map<string, number>();
  for (const row of rows) {
    perHome.set(row.homeId, (perHome.get(row.homeId) ?? 0) + Number(row.bytes));
  }

  const kinds = foldKinds(rows);

  return {
    kinds,
    total: sum(kinds),
    homes: homes
      .map((home) => ({ ...home, bytes: perHome.get(home.id) ?? 0 }))
      .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name)),
  };
}

const UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

/**
 * Bytes as somebody reads them off a phone screen.
 *
 * Powers of a thousand rather than of 1024, because that is what the number beside a
 * photo in every other app means, and one significant decimal below 100 so "1.4 MB"
 * and "970 kB" both fit in a donut's hole. Never a decimal on bytes: "512.0 B" is
 * a false precision about a number that is already exact.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }

  const decimals = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${UNITS[unit]}`;
}

/**
 * A share as a percentage, for the legend beside a chart.
 *
 * Rounded, but never to zero while there is anything there at all: a row reading "0%"
 * next to a size in kilobytes reads as a broken number rather than as a small one.
 */
export function formatShare(bytes: number, total: number): string {
  if (total <= 0 || bytes <= 0) return "0%";
  const share = (bytes / total) * 100;
  return `${share < 1 ? "<1" : Math.round(share)}%`;
}
