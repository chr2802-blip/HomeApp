import { describe, expect, it } from "vitest";
import { chartDay, periodDays, readPeriod, summarise } from "@/lib/baby-charts";
import type { BabyEntry } from "@/lib/baby";

// Copenhagen is UTC+1 in November.
let n = 0;
const entry = (kind: BabyEntry["kind"], startedAt: string, endedAt: string | null, details: unknown = {}): BabyEntry => ({
  id: `e${++n}`,
  kind,
  startedAt: new Date(startedAt),
  endedAt: endedAt ? new Date(endedAt) : null,
  details,
});
const now = new Date("2026-11-24T14:00:00Z");

describe("the period", () => {
  it("is a week unless it says otherwise", () => {
    expect(readPeriod("month")).toBe("month");
    expect(readPeriod("year")).toBe("week");
    expect(readPeriod(undefined)).toBe("week");
  });

  it("ends on the day it is anchored to, oldest first", () => {
    expect(periodDays("2026-11-24", "day")).toEqual(["2026-11-24"]);
    expect(periodDays("2026-11-24", "week")).toEqual([
      "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24",
    ]);
    expect(periodDays("2026-03-31", "month")).toHaveLength(30);
  });
});

describe("a day's row", () => {
  const night = entry("SLEEP", "2026-11-23T19:00:00Z", "2026-11-24T05:00:00Z"); // 20:00 → 06:00
  const nap = entry("SLEEP", "2026-11-24T11:00:00Z", "2026-11-24T12:30:00Z"); // 12:00 → 13:30
  const lateFeed = entry("FEED", "2026-11-23T22:50:00Z", "2026-11-23T23:20:00Z", { method: "BREAST", left: 1800 }); // 23:50 → 00:20
  const bottle = entry("FEED", "2026-11-24T09:00:00Z", null, { method: "BOTTLE", milk: "FORMULA", ml: 120 });
  const solid = entry("FEED", "2026-11-24T10:00:00Z", null, { method: "SOLID", food: "Grød" });
  const diaper = entry("DIAPER", "2026-11-24T07:00:00Z", null, { wet: true, dirty: true });
  const all = [night, nap, lateFeed, bottle, solid, diaper];

  it("counts a night on each day it covers, and naps apart from nights", () => {
    const yesterday = chartDay(all, "2026-11-23", now);
    const today = chartDay(all, "2026-11-24", now);
    expect(yesterday.nightHours).toBe(4);
    expect(today.nightHours).toBe(6);
    expect(today.napHours).toBe(1.5);
    expect(today.sleep).toEqual([
      { from: 0, to: 6, night: true },
      { from: 12, to: 13.5, night: false },
    ]);
  });

  it("puts a feed on the day it began, and adds up the bottles", () => {
    expect(chartDay(all, "2026-11-23", now).feedCount).toBe(1);
    const today = chartDay(all, "2026-11-24", now);
    expect(today.feeds).toEqual([
      { at: 10, method: "BOTTLE" },
      { at: 11, method: "SOLID" },
    ]);
    expect(today.ml).toBe(120);
    expect(today).toMatchObject({ diaperCount: 1, dirtyCount: 1, diapers: [{ at: 8 }] });
  });

  it("averages only over days with something logged", () => {
    const summary = summarise(all, periodDays("2026-11-24", "week"), now);
    expect(summary.days).toHaveLength(7);
    expect(summary.average.nightHours).toBe(5);
    expect(summary.average.feedCount).toBe(1.5);
    expect(summary.maxSleep).toBe(7.5);
  });
});
