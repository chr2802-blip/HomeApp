import { homeDb } from "@/lib/home-db";
import { shiftDay } from "@/lib/time";
import { dayBounds, solidSuggestions } from "@/lib/baby";
import type { WireEntry } from "@/components/baby/baby-log";

/** How far back the numbers at the top look before asking for the newest of a kind on its own. */
const RECENT_DAYS = 3;

/**
 * What the log draws for `day`, and what the "+" sheets read on both tabs (a breast feed
 * running, the side last given, the meals given before): the day and the one before it, the
 * last few days, anything still running, and the newest of each kind however old.
 */
export async function loadBabyLog(
  homeId: string,
  babyId: string,
  day: string,
  now: Date,
): Promise<{ entries: WireEntry[]; solids: string[] }> {
  const db = homeDb(homeId);
  const { end } = dayBounds(day);
  const recentFrom = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  // The day before too: a night that began yesterday evening is drawn on this one.
  const dayFrom = dayBounds(shiftDay(day, -1)).start;

  const select = { id: true, kind: true, startedAt: true, endedAt: true, details: true, note: true } as const;
  // The newest of each way of feeding on its own: each has a tile of its own, and a bottle
  // last given a week ago is still "a week ago" rather than "nothing yet".
  const lastOf = (method: string) =>
    db.babyEvent.findFirst({
      where: { babyId, kind: "FEED", details: { path: ["method"], equals: method } },
      orderBy: { startedAt: "desc" },
      select,
    });
  const [around, lastFeed, lastSleep, solids, lastBreast, lastBottle, lastSolid] = await Promise.all([
    db.babyEvent.findMany({
      where: {
        babyId,
        OR: [
          { startedAt: { gte: dayFrom, lt: end } },
          { startedAt: { gte: recentFrom } },
          { endedAt: null, kind: { in: ["SLEEP", "FEED"] } },
        ],
      },
      orderBy: { startedAt: "desc" },
      take: 400,
      select,
    }),
    db.babyEvent.findFirst({ where: { babyId, kind: "FEED" }, orderBy: { startedAt: "desc" }, select }),
    db.babyEvent.findFirst({ where: { babyId, kind: "SLEEP" }, orderBy: { startedAt: "desc" }, select }),
    db.babyEvent.findMany({
      where: { babyId, kind: "FEED", details: { path: ["method"], equals: "SOLID" } },
      orderBy: { startedAt: "desc" },
      take: 200,
      select: { id: true, kind: true, startedAt: true, endedAt: true, details: true },
    }),
    lastOf("BREAST"),
    lastOf("BOTTLE"),
    lastOf("SOLID"),
  ]);

  const byId = new Map<string, WireEntry>();
  for (const entry of [...around, lastFeed, lastSleep, lastBreast, lastBottle, lastSolid]) {
    if (!entry) continue;
    byId.set(entry.id, {
      id: entry.id,
      kind: entry.kind,
      startedAt: entry.startedAt.toISOString(),
      endedAt: entry.endedAt?.toISOString() ?? null,
      details: entry.details,
      note: entry.note,
    });
  }
  return { entries: [...byId.values()], solids: solidSuggestions(solids) };
}
