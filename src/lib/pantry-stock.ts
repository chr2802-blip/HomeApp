import { homeDb } from "./home-db";

/**
 * Everything the home says it has in, as keys.
 *
 * Only entries with more than zero: an entry at zero is something the household has
 * run out of, and the whole point of saying so is that it goes back on the list.
 *
 * Kept apart from the rest of `src/lib/pantry.ts`, which a client component reads for
 * its matching rules and its field names — `homeDb` reaches Prisma, and nothing runtime
 * from that may reach a client component the way `stripStocked` and `pantryNote` do.
 */
export async function stockedKeys(homeId: string): Promise<Set<string>> {
  const stocked = await homeDb(homeId).pantryItem.findMany({
    where: { quantity: { gt: 0 } },
    select: { key: true },
  });
  return new Set(stocked.map((item) => item.key));
}
