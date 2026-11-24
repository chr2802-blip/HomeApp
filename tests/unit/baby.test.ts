import { describe, expect, it } from "vitest";
import {
  clipToDay,
  diapersOn,
  entriesOn,
  isNightSleep,
  lastBreastSide,
  lastFeedAt,
  readBabyDetails,
  sideSeconds,
  sleepState,
  solidSuggestions,
  switchBreastSide,
  type BabyEntry,
  type BreastDetails,
} from "@/lib/baby";

// Copenhagen is UTC+1 in November: 22:00 there is 21:00Z.
const at = (iso: string) => new Date(iso);
let n = 0;
const entry = (kind: BabyEntry["kind"], startedAt: string, endedAt: string | null, details: unknown = {}): BabyEntry => ({
  id: `e${++n}`,
  kind,
  startedAt: at(startedAt),
  endedAt: endedAt ? at(endedAt) : null,
  details,
});

describe("readBabyDetails", () => {
  it("makes anything stored well-formed rather than throwing", () => {
    expect(readBabyDetails("SLEEP", null)).toEqual({ kind: "SLEEP", details: { night: null } });
    expect(readBabyDetails("DIAPER", { wet: "yes" })).toEqual({ kind: "DIAPER", details: { wet: false, dirty: false } });
    expect(readBabyDetails("FEED", { method: "BREAST", left: -3 }).details).toMatchObject({ left: 0, right: 0, running: null });
  });

  it("reads a feed with no known method as a bottle of unknown size", () => {
    expect(readBabyDetails("FEED", { method: "SPOON" }).details).toEqual({ method: "BOTTLE", milk: "FORMULA", ml: null });
    expect(readBabyDetails("FEED", { method: "BOTTLE", milk: "BREAST_MILK", ml: 120 }).details).toEqual({
      method: "BOTTLE",
      milk: "BREAST_MILK",
      ml: 120,
    });
  });
});

describe("isNightSleep", () => {
  it("decides from when the sleep started, on the household's clock", () => {
    expect(isNightSleep(at("2026-11-23T19:30:00Z"), null)).toBe(true); // 20:30
    expect(isNightSleep(at("2026-11-24T04:00:00Z"), null)).toBe(true); // 05:00
    expect(isNightSleep(at("2026-11-24T06:00:00Z"), null)).toBe(false); // 07:00
    expect(isNightSleep(at("2026-11-24T12:00:00Z"), null)).toBe(false); // 13:00
    expect(isNightSleep(at("2026-11-24T17:59:00Z"), null)).toBe(false); // 18:59
    expect(isNightSleep(at("2026-11-24T18:00:00Z"), null)).toBe(true); // 19:00
  });

  it("lets somebody's choice win", () => {
    expect(isNightSleep(at("2026-11-24T12:00:00Z"), true)).toBe(true);
    expect(isNightSleep(at("2026-11-23T21:00:00Z"), false)).toBe(false);
  });
});

describe("a breast feed's timer", () => {
  const start: BreastDetails = { method: "BREAST", left: 0, right: 0, running: null, runningSince: null, lastSide: null };

  it("counts a running side from when it started, whatever the app did meanwhile", () => {
    const running = switchBreastSide(start, "LEFT", at("2026-11-24T10:00:00Z"));
    expect(sideSeconds(running, "LEFT", at("2026-11-24T10:12:00Z"))).toBe(720);
    expect(sideSeconds(running, "RIGHT", at("2026-11-24T10:12:00Z"))).toBe(0);
  });

  it("banks a side when switching, so no second is lost or counted twice", () => {
    let details = switchBreastSide(start, "LEFT", at("2026-11-24T10:00:00Z"));
    details = switchBreastSide(details, "RIGHT", at("2026-11-24T10:10:00Z"));
    details = switchBreastSide(details, "LEFT", at("2026-11-24T10:15:00Z"));
    details = switchBreastSide(details, null, at("2026-11-24T10:17:00Z"));
    expect(details).toMatchObject({ left: 720, right: 300, running: null, runningSince: null, lastSide: "LEFT" });
  });

  it("knows the side the last feed ended on", () => {
    const feeds = [
      entry("FEED", "2026-11-24T06:00:00Z", "2026-11-24T06:20:00Z", { ...start, lastSide: "LEFT" }),
      entry("FEED", "2026-11-24T09:00:00Z", "2026-11-24T09:20:00Z", { ...start, lastSide: "RIGHT" }),
      entry("FEED", "2026-11-24T10:00:00Z", null, { method: "BOTTLE", milk: "FORMULA", ml: 90 }),
    ];
    expect(lastBreastSide(feeds)).toBe("RIGHT");
    expect(lastBreastSide([])).toBeNull();
  });
});

describe("clipToDay", () => {
  const now = at("2026-11-24T14:00:00Z");

  it("splits a sleep across midnight between the two days", () => {
    const night = entry("SLEEP", "2026-11-23T21:00:00Z", "2026-11-24T05:00:00Z"); // 22:00 → 06:00
    expect(clipToDay(night, "2026-11-23", now)).toEqual({ from: 22, to: 24 });
    expect(clipToDay(night, "2026-11-24", now)).toEqual({ from: 0, to: 6 });
    expect(clipToDay(night, "2026-11-25", now)).toBeNull();
  });

  it("cuts a running sleep at now", () => {
    const nap = entry("SLEEP", "2026-11-24T12:30:00Z", null); // 13:30, still asleep at 15:00
    expect(clipToDay(nap, "2026-11-24", now)).toEqual({ from: 13.5, to: 15 });
  });

  it("puts a moment at its own hour", () => {
    expect(clipToDay(entry("DIAPER", "2026-11-24T08:15:00Z", null), "2026-11-24", now)).toEqual({ from: 9.25, to: 9.25 });
  });

  it("orders a day newest first, with a running timer on top", () => {
    const sleep = entry("SLEEP", "2026-11-24T12:00:00Z", null);
    const diaper = entry("DIAPER", "2026-11-24T13:00:00Z", null);
    const old = entry("DIAPER", "2026-11-24T07:00:00Z", null);
    expect(entriesOn([old, diaper, sleep], "2026-11-24", now).map((e) => e.id)).toEqual([sleep.id, diaper.id, old.id]);
  });
});

describe("the numbers at the top", () => {
  const now = at("2026-11-24T14:00:00Z");

  it("says asleep since a running sleep began, even past a later nappy", () => {
    const entries = [entry("SLEEP", "2026-11-24T12:00:00Z", null), entry("DIAPER", "2026-11-24T13:00:00Z", null)];
    expect(sleepState(entries, now)).toEqual({ asleep: true, since: at("2026-11-24T12:00:00Z") });
  });

  it("says awake since the last sleep ended", () => {
    const entries = [
      entry("SLEEP", "2026-11-24T08:00:00Z", "2026-11-24T09:00:00Z"),
      entry("SLEEP", "2026-11-24T10:00:00Z", "2026-11-24T11:30:00Z"),
    ];
    expect(sleepState(entries, now)).toEqual({ asleep: false, since: at("2026-11-24T11:30:00Z") });
    expect(sleepState([], now)).toBeNull();
  });

  it("finds the last feed and counts the day's nappies", () => {
    const entries = [
      entry("FEED", "2026-11-24T09:00:00Z", null, { method: "BOTTLE" }),
      entry("FEED", "2026-11-24T12:10:00Z", null, { method: "SOLID", food: "Grød" }),
      entry("DIAPER", "2026-11-23T22:59:00Z", null), // 23:59 the day before
      entry("DIAPER", "2026-11-23T23:00:00Z", null), // 00:00
      entry("DIAPER", "2026-11-24T13:00:00Z", null),
    ];
    expect(lastFeedAt(entries, now)).toEqual(at("2026-11-24T12:10:00Z"));
    expect(diapersOn(entries, "2026-11-24")).toBe(2);
  });
});

describe("solidSuggestions", () => {
  it("offers what has been given, most often first, spelled as last written", () => {
    const solid = (startedAt: string, food: string) => entry("FEED", startedAt, null, { method: "SOLID", food });
    const entries = [
      solid("2026-11-20T09:00:00Z", "banan"),
      solid("2026-11-21T09:00:00Z", "Grød"),
      solid("2026-11-22T09:00:00Z", "grød"),
      solid("2026-11-23T09:00:00Z", " "),
    ];
    expect(solidSuggestions(entries)).toEqual(["grød", "banan"]);
  });
});
