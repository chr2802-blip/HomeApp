import { z } from "zod";
import type { BabyEventKind } from "@prisma/client";
import { dayStartInstant, hourInZone, shiftDay } from "./time";

/**
 * The baby log: what each kind of entry carries, and every question the page and the
 * charts ask of a list of them. No database and no clock of its own — `now` is always an
 * argument — so a test can say "ten past three in the night" and mean it.
 *
 * Every entry is a `BabyEvent`: a kind, when it started, when it ended if it lasts, and
 * `details` shaped by the kind. Those details are JSON in the database and are read only
 * through `readBabyDetails`, which answers a well-formed value for anything stored —
 * a field a later version added, or one an older one never wrote, must not take the
 * timeline down with it.
 */

export const BREAST_SIDES = ["LEFT", "RIGHT"] as const;
export type BreastSide = (typeof BREAST_SIDES)[number];

export const FEED_METHODS = ["BREAST", "BOTTLE", "SOLID"] as const;
export type FeedMethod = (typeof FEED_METHODS)[number];

export const BOTTLE_MILKS = ["BREAST_MILK", "FORMULA"] as const;
export type BottleMilk = (typeof BOTTLE_MILKS)[number];

/** Past this, a bottle is a typo rather than a feed. */
export const MAX_BOTTLE_ML = 1000;
/** Past this, a side's minutes are a typo rather than a feed. */
export const MAX_SIDE_SECONDS = 4 * 3600;
export const MAX_FOOD_LENGTH = 80;
export const MAX_NOTE_LENGTH = 500;
export const MAX_BABY_NAME_LENGTH = 60;

/**
 * Sleep that starts in this stretch of the household's day is night sleep, and anything
 * else a nap — unless somebody said otherwise (`SleepDetails.night`). Seven in the
 * evening to seven in the morning is when most families put a baby down for the night.
 */
export const NIGHT_FROM_HOUR = 19;
export const NIGHT_UNTIL_HOUR = 7;

const seconds = z.number().int().min(0).max(MAX_SIDE_SECONDS).catch(0);

const sleepSchema = z.object({
  /** null is "decide from the time it started" (`isNightSleep`), true or false an override. */
  night: z.boolean().nullable().catch(null),
});

const breastSchema = z.object({
  method: z.literal("BREAST"),
  /** Seconds fed on each side so far, not counting a side running now. */
  left: seconds,
  right: seconds,
  /** The side being fed on now, if a timer is running. */
  running: z.enum(BREAST_SIDES).nullable().catch(null),
  /** When the running side started: an ISO instant. */
  runningSince: z.iso.datetime().nullable().catch(null),
  /**
   * The side this feed ended on — what the next feed's "start on the other side" is
   * worked out from. Its own field because two totals cannot say which came last.
   */
  lastSide: z.enum(BREAST_SIDES).nullable().catch(null),
});

const bottleSchema = z.object({
  method: z.literal("BOTTLE"),
  milk: z.enum(BOTTLE_MILKS).catch("FORMULA"),
  ml: z.number().int().min(0).max(MAX_BOTTLE_ML).nullable().catch(null),
});

const solidSchema = z.object({
  method: z.literal("SOLID"),
  food: z.string().max(MAX_FOOD_LENGTH).catch(""),
});

const diaperSchema = z.object({
  wet: z.boolean().catch(false),
  dirty: z.boolean().catch(false),
});

export type SleepDetails = z.infer<typeof sleepSchema>;
export type BreastDetails = z.infer<typeof breastSchema>;
export type BottleDetails = z.infer<typeof bottleSchema>;
export type SolidDetails = z.infer<typeof solidSchema>;
export type FeedDetails = BreastDetails | BottleDetails | SolidDetails;
export type DiaperDetails = z.infer<typeof diaperSchema>;

export type BabyDetails =
  | { kind: "SLEEP"; details: SleepDetails }
  | { kind: "FEED"; details: FeedDetails }
  | { kind: "DIAPER"; details: DiaperDetails };

/** A stored entry, as much of it as the questions below need. */
export type BabyEntry = {
  id: string;
  kind: BabyEventKind;
  startedAt: Date;
  endedAt: Date | null;
  details: unknown;
  note?: string | null;
};

const EMPTY_BREAST: BreastDetails = {
  method: "BREAST",
  left: 0,
  right: 0,
  running: null,
  runningSince: null,
  lastSide: null,
};

/**
 * The details of a stored entry, made well-formed. A feed whose method is missing or
 * unknown is read as a bottle of unknown size rather than thrown away — it was still a
 * feed, and the "time since the last feed" is the number at 3 a.m. that matters.
 */
export function readBabyDetails(kind: "SLEEP", raw: unknown): { kind: "SLEEP"; details: SleepDetails };
export function readBabyDetails(kind: "FEED", raw: unknown): { kind: "FEED"; details: FeedDetails };
export function readBabyDetails(kind: "DIAPER", raw: unknown): { kind: "DIAPER"; details: DiaperDetails };
export function readBabyDetails(kind: BabyEventKind, raw: unknown): BabyDetails;
export function readBabyDetails(kind: BabyEventKind, raw: unknown): BabyDetails {
  const value = raw && typeof raw === "object" ? raw : {};
  switch (kind) {
    case "SLEEP":
      return { kind, details: sleepSchema.parse({ night: null, ...value }) };
    case "DIAPER":
      return { kind, details: diaperSchema.parse(value) };
    case "FEED": {
      const method = (value as { method?: unknown }).method;
      if (method === "BREAST") return { kind, details: breastSchema.parse({ ...EMPTY_BREAST, ...value }) };
      if (method === "SOLID") return { kind, details: solidSchema.parse({ food: "", ...value }) };
      return { kind, details: bottleSchema.parse({ milk: "FORMULA", ml: null, ...value, method: "BOTTLE" }) };
    }
  }
}

/** What a feed was, for an entry known to be one. */
export function feedMethodOf(entry: BabyEntry): FeedMethod | null {
  if (entry.kind !== "FEED") return null;
  return (readBabyDetails("FEED", entry.details).details as FeedDetails).method;
}

/**
 * Whether a sleep is night sleep: the override where somebody chose, and otherwise
 * whether it started between `NIGHT_FROM_HOUR` and `NIGHT_UNTIL_HOUR` on the household's
 * clock. Decided by when it *started*, so a sleep from 18:30 to 06:00 is a long nap the
 * household can correct, rather than changing its mind as the clock passes seven.
 */
export function isNightSleep(startedAt: Date, override: boolean | null): boolean {
  if (override !== null) return override;
  const hour = hourInZone(startedAt);
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_UNTIL_HOUR;
}

/** Seconds fed on one side, counting a timer running on it now. */
export function sideSeconds(details: BreastDetails, side: BreastSide, now: Date): number {
  const stored = side === "LEFT" ? details.left : details.right;
  if (details.running !== side || !details.runningSince) return stored;
  const since = Date.parse(details.runningSince);
  return stored + Math.max(0, Math.floor((now.getTime() - since) / 1000));
}

/**
 * A breast feed's timer moved to `side` (or stopped, for null): what was running is
 * banked into its side's total first, so no second is counted twice or lost however
 * often the sides are swapped.
 */
export function switchBreastSide(details: BreastDetails, side: BreastSide | null, now: Date): BreastDetails {
  const banked: BreastDetails = {
    ...details,
    left: Math.min(MAX_SIDE_SECONDS, sideSeconds(details, "LEFT", now)),
    right: Math.min(MAX_SIDE_SECONDS, sideSeconds(details, "RIGHT", now)),
    running: null,
    runningSince: null,
  };
  if (side === null) return banked;
  return { ...banked, running: side, runningSince: now.toISOString(), lastSide: side };
}

/** The side the last breast feed ended on, which is the one *not* to start with. */
export function lastBreastSide(entries: readonly BabyEntry[]): BreastSide | null {
  const feeds = entries
    .filter((entry) => feedMethodOf(entry) === "BREAST")
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  for (const feed of feeds) {
    const details = readBabyDetails("FEED", feed.details).details as BreastDetails;
    if (details.lastSide) return details.lastSide;
  }
  return null;
}

/** The other side. */
export function otherSide(side: BreastSide): BreastSide {
  return side === "LEFT" ? "RIGHT" : "LEFT";
}

/**
 * How long after a breast feed was finished it can still be carried on as the same
 * feed — the baby put down for a nappy, or back at the breast ten minutes later. Past
 * this it is a new feed, and "time since the last feed" should say so.
 */
export const RESUME_FEED_WITHIN_MS = 60 * 60_000;

/**
 * The breast feed that "Continue" would carry on: the newest one, finished no longer
 * than `RESUME_FEED_WITHIN_MS` ago. None while a breast feed is running — there is
 * only ever one timer, and that one is already going.
 */
export function resumableFeed(entries: readonly BabyEntry[], now: Date): BabyEntry | null {
  const feeds = entries.filter((entry) => feedMethodOf(entry) === "BREAST");
  if (feeds.some((entry) => !entry.endedAt)) return null;
  const newest = feeds.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  if (!newest?.endedAt) return null;
  const since = now.getTime() - newest.endedAt.getTime();
  return since >= 0 && since <= RESUME_FEED_WITHIN_MS ? newest : null;
}

/** Whether an entry is a timer still going: a sleep or a breast feed with no end yet. */
export function isRunning(entry: BabyEntry): boolean {
  if (entry.endedAt) return false;
  return entry.kind === "SLEEP" || feedMethodOf(entry) === "BREAST";
}

/** When an entry ended, for reading — a running one ends now, and a moment ends as it starts. */
export function endOf(entry: BabyEntry, now: Date): Date {
  if (entry.endedAt) return entry.endedAt;
  return isRunning(entry) ? now : entry.startedAt;
}

/**
 * What the top of the page says about sleep: asleep since a moment, awake since one, or
 * nothing yet. A sleep still running wins over any later entry, since a nappy changed in
 * the dark does not wake anybody in the log.
 */
export type SleepState = { asleep: true; since: Date } | { asleep: false; since: Date } | null;

export function sleepState(entries: readonly BabyEntry[], now: Date): SleepState {
  const sleeps = entries.filter((entry) => entry.kind === "SLEEP" && entry.startedAt <= now);
  const running = sleeps
    .filter((entry) => !entry.endedAt)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  if (running) return { asleep: true, since: running.startedAt };
  const lastEnd = sleeps
    .map((entry) => entry.endedAt!)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return lastEnd ? { asleep: false, since: lastEnd } : null;
}

/** When the newest feed started, or null for none. */
export function lastFeedAt(entries: readonly BabyEntry[], now: Date): Date | null {
  const feeds = entries.filter((entry) => entry.kind === "FEED" && entry.startedAt <= now);
  if (feeds.length === 0) return null;
  return new Date(Math.max(...feeds.map((entry) => entry.startedAt.getTime())));
}

/** The instants a day in the household's zone runs between, the end exclusive. */
export function dayBounds(day: string): { start: Date; end: Date } {
  return { start: dayStartInstant(day), end: dayStartInstant(shiftDay(day, 1)) };
}

/**
 * The part of an entry that falls on a day, as hours from that day's midnight — the
 * timeline strip's and the sleep chart's one question. A sleep from 22:00 to 06:00 is
 * two hours on the first day and six on the second; a running one is cut at `now`.
 * Null when none of it falls on the day.
 */
export function clipToDay(entry: BabyEntry, day: string, now: Date): { from: number; to: number } | null {
  const { start, end } = dayBounds(day);
  const from = Math.max(entry.startedAt.getTime(), start.getTime());
  const to = Math.min(endOf(entry, now).getTime(), end.getTime());
  if (to < from || from >= end.getTime() || to < start.getTime()) return null;
  const hours = (instant: number) => (instant - start.getTime()) / 3_600_000;
  return { from: hours(from), to: hours(to) };
}

/** The entries with any part on a day, newest first — a running one always on top. */
export function entriesOn(entries: readonly BabyEntry[], day: string, now: Date): BabyEntry[] {
  return entries
    .filter((entry) => clipToDay(entry, day, now) !== null)
    .sort((a, b) => {
      const running = Number(isRunning(b)) - Number(isRunning(a));
      return running || b.startedAt.getTime() - a.startedAt.getTime();
    });
}

/** How many nappies were changed on a day. */
export function diapersOn(entries: readonly BabyEntry[], day: string): number {
  const { start, end } = dayBounds(day);
  return entries.filter((entry) => entry.kind === "DIAPER" && entry.startedAt >= start && entry.startedAt < end)
    .length;
}

/**
 * The solids this baby has been given, most often first — what the food field offers
 * before anything is typed. Spelled as last written, compared without case.
 */
export function solidSuggestions(entries: readonly BabyEntry[], limit = 8): string[] {
  const counts = new Map<string, { name: string; count: number; last: number }>();
  for (const entry of entries) {
    if (feedMethodOf(entry) !== "SOLID") continue;
    const food = (readBabyDetails("FEED", entry.details).details as SolidDetails).food.trim();
    if (!food) continue;
    const key = food.toLocaleLowerCase();
    const seen = counts.get(key);
    const at = entry.startedAt.getTime();
    if (!seen) counts.set(key, { name: food, count: 1, last: at });
    else counts.set(key, { name: at > seen.last ? food : seen.name, count: seen.count + 1, last: Math.max(at, seen.last) });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, limit)
    .map((entry) => entry.name);
}

