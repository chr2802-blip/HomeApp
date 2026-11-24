import { clipToDay, dayBounds, feedMethodOf, isNightSleep, readBabyDetails, type BabyEntry, type FeedMethod } from "./baby";
import { shiftDay } from "./time";

/**
 * What the baby log's charts draw, worked out from the entries and nothing else. Every
 * number is per day in the household's zone, and a sleep is counted on each day it
 * covers — a night from 22:00 to 06:00 is two hours on one row and six on the next — so
 * a row and its total always agree.
 */

export const CHART_PERIODS = ["day", "week", "month"] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

/** How many days each period draws, ending on the day it is anchored to. */
export const PERIOD_DAYS: Record<ChartPeriod, number> = { day: 1, week: 7, month: 30 };

export function readPeriod(raw: string | undefined): ChartPeriod {
  return (CHART_PERIODS as readonly string[]).includes(raw ?? "") ? (raw as ChartPeriod) : "week";
}

/** The days a period covers, oldest first, ending on `anchor`. */
export function periodDays(anchor: string, period: ChartPeriod): string[] {
  const count = PERIOD_DAYS[period];
  return Array.from({ length: count }, (_, index) => shiftDay(anchor, index - count + 1));
}

export type SleepBlock = { from: number; to: number; night: boolean };
export type Mark = { at: number };
export type FeedMark = Mark & { method: FeedMethod };

export type DayChart = {
  day: string;
  sleep: SleepBlock[];
  feeds: FeedMark[];
  diapers: Mark[];
  nightHours: number;
  napHours: number;
  feedCount: number;
  ml: number;
  diaperCount: number;
  dirtyCount: number;
};

/** One row of every chart: where the sleep, the feeds and the nappies fell on a day. */
export function chartDay(entries: readonly BabyEntry[], day: string, now: Date): DayChart {
  const row: DayChart = {
    day,
    sleep: [],
    feeds: [],
    diapers: [],
    nightHours: 0,
    napHours: 0,
    feedCount: 0,
    ml: 0,
    diaperCount: 0,
    dirtyCount: 0,
  };
  for (const entry of entries) {
    const clip = clipToDay(entry, day, now);
    if (!clip) continue;
    if (entry.kind === "SLEEP") {
      const night = isNightSleep(entry.startedAt, readBabyDetails("SLEEP", entry.details).details.night);
      row.sleep.push({ ...clip, night });
      if (night) row.nightHours += clip.to - clip.from;
      else row.napHours += clip.to - clip.from;
      continue;
    }
    // A feed belongs to the day it began on, not to every day its timer touched.
    if (entry.startedAt < dayBounds(day).start) continue;
    if (entry.kind === "FEED") {
      const method = feedMethodOf(entry)!;
      row.feeds.push({ at: clip.from, method });
      row.feedCount += 1;
      const details = readBabyDetails("FEED", entry.details).details;
      if (details.method === "BOTTLE" && details.ml) row.ml += details.ml;
    } else {
      const details = readBabyDetails("DIAPER", entry.details).details;
      row.diapers.push({ at: clip.from });
      row.diaperCount += 1;
      if (details.dirty) row.dirtyCount += 1;
    }
  }
  row.sleep.sort((a, b) => a.from - b.from);
  row.feeds.sort((a, b) => a.at - b.at);
  row.diapers.sort((a, b) => a.at - b.at);
  return row;
}

export type PeriodSummary = {
  days: DayChart[];
  /** Per day, over the days that have anything logged — a day before the log began is not a zero. */
  average: { nightHours: number; napHours: number; feedCount: number; ml: number; diaperCount: number };
  /** The longest day of sleep in the period, for the bars' scale. */
  maxSleep: number;
  maxDiapers: number;
};

export function summarise(entries: readonly BabyEntry[], days: readonly string[], now: Date): PeriodSummary {
  const charts = days.map((day) => chartDay(entries, day, now));
  const logged = charts.filter((row) => row.sleep.length + row.feedCount + row.diaperCount > 0);
  const mean = (pick: (row: DayChart) => number) =>
    logged.length === 0 ? 0 : logged.reduce((sum, row) => sum + pick(row), 0) / logged.length;
  return {
    days: charts,
    average: {
      nightHours: mean((row) => row.nightHours),
      napHours: mean((row) => row.napHours),
      feedCount: mean((row) => row.feedCount),
      ml: mean((row) => row.ml),
      diaperCount: mean((row) => row.diaperCount),
    },
    maxSleep: Math.max(0, ...charts.map((row) => row.nightHours + row.napHours)),
    maxDiapers: Math.max(0, ...charts.map((row) => row.diaperCount)),
  };
}
