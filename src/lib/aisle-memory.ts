import type { ShopAisle } from "@prisma/client";
import { homeDb } from "./home-db";
import { pantryKey } from "./pantry";

/**
 * What this household has said about where the things on a list are bought — the stored
 * `AisleChoice` rows for the keys of `texts`, and only those.
 *
 * One function for the list's page and its version route, because the two have to hash
 * the same answer (`listVersion`): somebody moving the cream on one phone is a change the
 * other phone's page draws.
 */
export async function rememberedAisles(
  homeId: string,
  texts: string[],
): Promise<Record<string, ShopAisle>> {
  const keys = [...new Set(texts.map(pantryKey).filter(Boolean))];
  if (keys.length === 0) return {};
  const rows = await homeDb(homeId).aisleChoice.findMany({
    where: { key: { in: keys } },
    select: { key: true, aisle: true },
  });
  return Object.fromEntries(rows.map((row) => [row.key, row.aisle]));
}
