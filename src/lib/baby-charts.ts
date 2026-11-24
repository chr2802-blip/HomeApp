import { clipToDay, dayBounds, endOf, sleptMs, feedMethodOf, isNightSleep, readBabyDetails, type BabyEntry, type FeedMethod } from "./baby";
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
  /**
   * The rest of the day's hours that have happened: 24 less the sleep (23 or 25 on the
   * days the clocks change), and on today only up to now — the hours still to come are
   * nobody's yet. Zero on a day with nothing logged, which is a day before the log began
   * rather than a day spent awake.
   */
  awakeHours: number;
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
    awakeHours: 0,
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
      // Time awake inside a sleep is not placed, so each day keeps its share of it.
      const span = endOf(entry, now).getTime() - entry.startedAt.getTime();
      const hours = (clip.to - clip.from) * (span > 0 ? sleptMs(entry, now) / span : 1);
      if (night) row.nightHours += hours;
      else row.napHours += hours;
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
  if (row.sleep.length + row.feedCount + row.diaperCount > 0) {
    const { start, end } = dayBounds(day);
    const passed = (Math.min(now.getTime(), end.getTime()) - start.getTime()) / 3_600_000;
    row.awakeHours = Math.max(0, passed - row.nightHours - row.napHours);
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
  /**
   * The middle day of the period, as a row of its own — null where fewer than two days
   * have anything logged, since the median of one day is that day.
   */
  median: DayChart | null;
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
    median: medianDay(logged),
    maxSleep: Math.max(0, ...charts.map((row) => row.nightHours + row.napHours)),
    maxDiapers: Math.max(0, ...charts.map((row) => row.diaperCount)),
  };
}

/** The middle value, the mean of the two middle ones for an even count; 0 for none. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** How finely the median day's sleep is placed on the clock: quarter hours. */
export const MEDIAN_SLOT_HOURS = 0.25;

/**
 * The typical day of a set of days, every figure its median over them. On the clock the
 * baby is asleep in a quarter hour where more than half of the days were — so a nap that
 * moves about by half an hour still shows, where an average would smear it thin — and it
 * is a night where most of those sleeps were. The n-th feed or nappy sits at the median
 * time of the days' n-th, for as many as the median day has.
 */
export function medianDay(days: readonly DayChart[]): DayChart | null {
  if (days.length < 2) return null;
  const sleep: SleepBlock[] = [];
  for (let from = 0; from < 24; from += MEDIAN_SLOT_HOURS) {
    const middle = from + MEDIAN_SLOT_HOURS / 2;
    const asleep = days
      .map((row) => row.sleep.find((block) => block.from <= middle && middle < block.to))
      .filter((block): block is SleepBlock => block !== undefined);
    if (asleep.length * 2 <= days.length) continue;
    const night = asleep.filter((block) => block.night).length * 2 >= asleep.length;
    const last = sleep.at(-1);
    if (last && last.to === from && last.night === night) last.to = from + MEDIAN_SLOT_HOURS;
    else sleep.push({ from, to: from + MEDIAN_SLOT_HOURS, night });
  }
  // Each mark keeps the kind of the day's own mark nearest the median time — a bottle stays a bottle.
  const typicalMarks = <T extends Mark>(lists: readonly (readonly T[])[], count: number): T[] =>
    Array.from({ length: count }, (_, index) => {
      const nth = lists.map((list) => list[index]).filter((mark): mark is T => mark !== undefined);
      const at = median(nth.map((mark) => mark.at));
      const nearest = nth.reduce((best, mark) => (Math.abs(mark.at - at) < Math.abs(best.at - at) ? mark : best));
      return { ...nearest, at };
    });
  const feedCount = Math.round(median(days.map((row) => row.feedCount)));
  const diaperCount = Math.round(median(days.map((row) => row.diaperCount)));
  return {
    day: "median",
    sleep,
    feeds: typicalMarks(days.map((row) => row.feeds), feedCount),
    diapers: typicalMarks(days.map((row) => row.diapers), diaperCount),
    nightHours: median(days.map((row) => row.nightHours)),
    napHours: median(days.map((row) => row.napHours)),
    awakeHours: median(days.map((row) => row.awakeHours)),
    feedCount,
    ml: median(days.map((row) => row.ml)),
    diaperCount,
    dirtyCount: Math.round(median(days.map((row) => row.dirtyCount))),
  };
}
