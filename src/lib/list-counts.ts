import { homeDb } from "./home-db";

/**
 * How many items are still open on each of a home's lists.
 *
 * The pages that draw a list card want two numbers — how much is left, and how much
 * there is — and a card says both: "3 open" beside a bar that is three-fifths short.
 * They used to be got by fetching every open item's id and reading `.length` off the
 * array, which is a row per item pulled across the wire to produce one integer. A home
 * with a dozen lists averaging fifty open items fetched six hundred rows to draw twelve
 * numbers.
 *
 * Postgres will count them, so it counts them. What it will *not* do is count them two
 * ways at once: `_count.select` is keyed by the relation's own name, so `items` can
 * carry a total or a filter and not both — written together the second key simply
 * overwrites the first, and the query comes back with the filtered number wearing the
 * total's name. That is a quiet wrong answer rather than an error, which is why the two
 * counts are two queries here and why this comment exists.
 *
 * The other half stays where it was: the list query the page already makes keeps its
 * plain `_count`, which is the total. This adds the open half beside it, for the whole
 * home in one go, because both callers draw a subset chosen after the counting — the
 * dashboard takes the favourites or the four most recent, and asking per card would be
 * the round trip per list this exists to remove.
 */
export async function openItemCounts(homeId: string): Promise<Map<string, number>> {
  const lists = await homeDb(homeId).list.findMany({
    select: { id: true, _count: { select: { items: { where: { done: false } } } } },
  });

  return new Map(lists.map((list) => [list.id, list._count.items]));
}
