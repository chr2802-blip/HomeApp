import type { HomeLanguage } from "@prisma/client";
import { homeDb } from "./home-db";
import { previousWeekStart, weekStartInZone } from "./time";
import { sayIn } from "./copy/say";
import { STREAK } from "./copy/dashboard";

/**
 * How many weeks running this household has cleared a list, and how many it has
 * cleared in the week it is in.
 *
 * The household's rhythm and not a person's, which is the same choice the dashboard's
 * task count already makes: what is stored is that a list was finished here, never by
 * whom. A streak that belonged to somebody would turn a shared shopping list into a
 * thing worth racing another member to tick.
 */
export type Streak = {
  /** Consecutive weeks up to and including the live one. Zero when the run is broken. */
  weeks: number;
  /** Lists cleared in the current week, which is the part still in the household's hands. */
  thisWeek: number;
};

/**
 * Two years of weeks is far more than any streak the page can usefully show, and the
 * walk below stops at the first gap in any case — so this bounds the query rather than
 * the answer.
 */
const HISTORY_WEEKS = 104;

/**
 * Records that a list was cleared, in whichever week the household is in now.
 *
 * One row per home per week: a second list cleared in the same week raises `count`
 * rather than adding a row, so the table is bounded and "was anything cleared that
 * week" stays the question the row answers. `upsert` rather than a read and a write,
 * because two people finishing their own lists at once would otherwise both find no
 * row and both try to create it.
 */
export async function recordListCleared(homeId: string) {
  const week = weekStartInZone();

  await homeDb(homeId).clearedWeek.upsert({
    // homeDb stamps the home onto a create and adds it to the where, but its types
    // still ask for the column — the same shape `pickAndStore` uses for a suggestion.
    where: { homeId_week: { homeId, week } },
    create: { homeId, week },
    update: { count: { increment: 1 } },
  });
}

/**
 * The household's streak as of now.
 *
 * A run counts as alive when it reaches either this week or the last one. The week
 * being lived in is not over, so a household that cleared something last Saturday and
 * has not been shopping since has broken nothing — expiring the streak at midnight on
 * Sunday would punish them for the calendar rather than for anything they did. It ends
 * the moment a whole week passes with nothing cleared in it.
 */
export async function homeStreak(homeId: string): Promise<Streak> {
  const rows = await homeDb(homeId).clearedWeek.findMany({
    // "yyyy-MM-dd" sorts chronologically as text, which is half of why the week is
    // stored the way it is.
    orderBy: { week: "desc" },
    take: HISTORY_WEEKS,
    select: { week: true, count: true },
  });

  const cleared = new Map(rows.map((row) => [row.week, row.count]));
  const current = weekStartInZone();
  const thisWeek = cleared.get(current) ?? 0;

  let cursor: string | null = cleared.has(current)
    ? current
    : cleared.has(previousWeekStart(current))
      ? previousWeekStart(current)
      : null;
  if (cursor === null) return { weeks: 0, thisWeek };

  let weeks = 0;
  while (cleared.has(cursor)) {
    weeks += 1;
    cursor = previousWeekStart(cursor);
  }

  return { weeks, thisWeek };
}

/**
 * The streak in words.
 *
 * One week is not a run, so it is not called one — "a list cleared this week" is what
 * happened, and calling it a streak of one would be the app congratulating somebody for
 * using it once. From two weeks up it is a run, and the second half of the line is the
 * part that is actually live: a run that has nothing in the current week is a run with
 * a few days left to save it, and saying so is the whole of what a streak is for.
 */
export function streakLine({ weeks, thisWeek }: Streak, language: HomeLanguage) {
  const say = sayIn(language);
  const lists = say(STREAK.listsCleared, { count: thisWeek });

  if (weeks === 1) {
    return thisWeek > 0 ? say(STREAK.oneWeekWithClears, { lists }) : say(STREAK.oneWeekNoClearsYet);
  }

  return thisWeek > 0
    ? say(STREAK.runningWithClears, { weeks, lists })
    : say(STREAK.runningNoClearsYet, { weeks });
}
