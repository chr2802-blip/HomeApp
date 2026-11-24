import { describe, expect, it } from "vitest";
import { clockWords, describeEntry, durationWords } from "@/lib/baby-words";
import { instantFromLocal, localInputValue } from "@/lib/time";

const now = new Date("2026-11-24T14:00:00Z");

describe("lengths of time", () => {
  it("are minutes, then hours and minutes, in the household's language", () => {
    expect(durationWords(42 * 60_000, "DA")).toBe("42 m");
    expect(durationWords(70 * 60_000, "DA")).toBe("1 t 10 m");
    expect(durationWords(120 * 60_000, "DA")).toBe("2 t");
    expect(durationWords(70 * 60_000, "EN")).toBe("1 h 10 m");
    expect(durationWords(-5, "EN")).toBe("0 m");
  });

  it("run to the second on a timer", () => {
    expect(clockWords(247_000)).toBe("4:07");
    expect(clockWords(3_729_000)).toBe("1:02:09");
  });
});

describe("describeEntry", () => {
  it("reads a sleep across midnight as night sleep with its span", () => {
    const sleep = {
      id: "s",
      kind: "SLEEP" as const,
      startedAt: new Date("2026-11-23T19:05:00Z"),
      endedAt: new Date("2026-11-24T05:25:00Z"),
      details: { night: null },
    };
    expect(describeEntry(sleep, "DA", now)).toEqual({ title: "Nattesøvn", detail: "20:05–06:25 · 10 t 20 m" });
  });

  it("reads a running sleep as asleep now, counting", () => {
    const sleep = { id: "s", kind: "SLEEP" as const, startedAt: new Date("2026-11-24T13:18:00Z"), endedAt: null, details: {} };
    expect(describeEntry(sleep, "EN", now)).toEqual({ title: "Asleep now", detail: "Nap · 42 m and counting" });
  });

  it("reads feeds and nappies", () => {
    const at = new Date("2026-11-24T12:00:00Z");
    expect(describeEntry({ id: "b", kind: "FEED", startedAt: at, endedAt: null, details: { method: "BOTTLE", milk: "FORMULA", ml: 120 } }, "DA", now))
      .toEqual({ title: "Flaske", detail: "120 ml · Erstatning" });
    expect(describeEntry({ id: "f", kind: "FEED", startedAt: at, endedAt: null, details: { method: "SOLID", food: "Grød" } }, "DA", now))
      .toEqual({ title: "Fast føde", detail: "Grød" });
    expect(describeEntry({ id: "d", kind: "DIAPER", startedAt: at, endedAt: null, details: { wet: true, dirty: true } }, "DA", now))
      .toEqual({ title: "Ble", detail: "Begge" });
    expect(
      describeEntry(
        { id: "a", kind: "FEED", startedAt: at, endedAt: at, details: { method: "BREAST", left: 720, right: 480, lastSide: "RIGHT" } },
        "DA",
        now,
      ),
    ).toEqual({ title: "Amning", detail: "Venstre 12 m · højre 8 m" });
  });
});

describe("a datetime-local value", () => {
  it("is read and written on the household's clock", () => {
    expect(instantFromLocal("2026-11-24T21:30")).toEqual(new Date("2026-11-24T20:30:00Z"));
    expect(instantFromLocal("2026-07-01T08:00")).toEqual(new Date("2026-07-01T06:00:00Z"));
    expect(localInputValue(new Date("2026-11-24T20:30:00Z"))).toBe("2026-11-24T21:30");
  });

  it("refuses what is not a real time", () => {
    expect(instantFromLocal("")).toBeNull();
    expect(instantFromLocal("2026-02-31T10:00")).toBeNull();
    expect(instantFromLocal("tomorrow")).toBeNull();
  });
});
