import { dueAtDaysFrom } from "@/lib/time";

/** How far back Settings' "Done" tab counts: a month is long enough to even out a busy week. */
export const CREDIT_DAYS = 30;

/** How many of the latest presses the tab lists under the tally. */
export const RECENT_COMPLETIONS = 20;

/** The instant the tally starts from. Takes the clock, so a test can say when "now" is. */
export function creditSince(now: Date): Date {
  return dueAtDaysFrom(-CREDIT_DAYS, now);
}

export type CreditMember = { id: string; name: string; photoId: string | null };

export type CreditRow = {
  /** A member's id, or null for presses by somebody who has since left the home. */
  userId: string | null;
  name: string | null;
  photoId: string | null;
  done: number;
};

/**
 * Who has done how many of the household's jobs: one row per member of the home — those
 * who did none included, since a tally that leaves them out says nothing about them —
 * plus one row for people who have left, only when they did some. Most first, then by
 * name, so two people on the same count do not swap places between visits.
 */
export function tallyCompletions(
  completions: readonly { userId: string | null }[],
  members: readonly CreditMember[],
): CreditRow[] {
  const counts = new Map<string | null, number>();
  for (const { userId } of completions) {
    // A press by somebody no longer in the home counts as "left", wherever their row went.
    const key = userId !== null && members.some((m) => m.id === userId) ? userId : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rows: CreditRow[] = members.map((m) => ({
    userId: m.id,
    name: m.name,
    photoId: m.photoId,
    done: counts.get(m.id) ?? 0,
  }));
  rows.sort((a, b) => b.done - a.done || a.name!.localeCompare(b.name!));

  const gone = counts.get(null) ?? 0;
  if (gone > 0) rows.push({ userId: null, name: null, photoId: null, done: gone });
  return rows;
}
