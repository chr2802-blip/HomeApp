import type { Prisma } from "@prisma/client";
import { homeDb } from "./home-db";
import { UNFINISHED } from "./tasks";
import { nextWeekStart, weekStartInstant, weekStartInZone } from "./time";

/**
 * What the household's week is carrying, and how much of it is behind them.
 *
 * `done + outstanding` is the week's work, and **every task falls on exactly one
 * side**. That is the whole difficulty here: a recurring task is never finished, so
 * "completed this week" and "still owed" are not opposites the way they are for a
 * one-off. Emptying the bins on Monday when they come round again on Wednesday is a
 * job done and a job owed, and counting it as both would make a household of one task
 * read "1 of 2".
 *
 * So being owed wins. A task due again before the week is out is this week's work
 * still, whatever was done to it on Monday; a task with nothing due until next month is
 * done with as far as this week is concerned. The bar then answers "how much of this
 * week is behind us", which is the question somebody opening the dashboard is asking.
 */
export type WeekWork = {
  /** Tasks dealt with this week and not due again before it ends. */
  done: number;
  /** Tasks due before the week is out and not done — including everything overdue. */
  outstanding: number;
};

/**
 * Everything the household still owes this week.
 *
 * **The whole week, not the part of it that has happened.** A recurring task due on
 * Friday is this week's work on Monday morning — a denominator that grew by one every
 * time a day turned over would mean a bar that fell back each morning however much the
 * household got through, which is a progress bar that punishes progress.
 *
 * The bound is the start of next Monday rather than the end of Sunday: one instant,
 * exclusive, with no last-millisecond arithmetic to get wrong. Everything overdue from
 * before this week is inside it too, because a job nobody has done since March is owed
 * today whatever week it first came due in.
 */
function owedThisWeek(now: Date): Prisma.TaskWhereInput {
  return {
    nextDueAt: { lt: weekStartInstant(nextWeekStart(weekStartInZone(now))) },
    ...UNFINISHED,
  };
}

export async function weekWorkload(homeId: string, now: Date = new Date()): Promise<WeekWork> {
  const owed = owedThisWeek(now);
  const since = weekStartInstant(weekStartInZone(now));
  const db = homeDb(homeId);

  const [outstanding, done] = await Promise.all([
    db.task.count({ where: owed }),
    // Completed since Monday and not owed again before the week is out. Whoever did it:
    // this is the household's own rhythm, not a personal scoreboard.
    db.task.count({ where: { lastCompletedAt: { gte: since }, NOT: owed } }),
  ]);

  return { done, outstanding };
}
