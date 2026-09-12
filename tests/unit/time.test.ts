import { describe, expect, it } from "vitest";
import {
  DUE_HOUR,
  calendarDaysBetween,
  dueAtDaysFrom,
  dueAtOn,
  endOfDayInZone,
  formatInZone,
  todayInZone,
} from "@/lib/time";

/**
 * These assert exact UTC instants. That is the point: the results must not depend on
 * the timezone of the machine running them, so they hold identically on a laptop in
 * Copenhagen and on a build server in UTC.
 */

describe("dueAtOn", () => {
  it("puts the due time at 09:00 local, which is 07:00 UTC in summer", () => {
    expect(dueAtOn("2026-06-01")?.toISOString()).toBe("2026-06-01T07:00:00.000Z");
  });

  it("follows the clock change, so winter is 08:00 UTC", () => {
    expect(dueAtOn("2026-01-15")?.toISOString()).toBe("2026-01-15T08:00:00.000Z");
  });

  it("handles the day either side of the spring change", () => {
    // Denmark moves to summer time on 29 March 2026.
    expect(dueAtOn("2026-03-28")?.toISOString()).toBe("2026-03-28T08:00:00.000Z");
    expect(dueAtOn("2026-03-30")?.toISOString()).toBe("2026-03-30T07:00:00.000Z");
  });

  it("rejects anything that is not a real calendar date", () => {
    expect(dueAtOn("")).toBeNull();
    expect(dueAtOn("not-a-date")).toBeNull();
    expect(dueAtOn("2026-13-01")).toBeNull();
    expect(dueAtOn("2026-02-31")).toBeNull();
    expect(dueAtOn("01-06-2026")).toBeNull();
  });

  it("accepts a leap day in a leap year and rejects it otherwise", () => {
    expect(dueAtOn("2028-02-29")).not.toBeNull();
    expect(dueAtOn("2026-02-29")).toBeNull();
  });
});

describe("dueAtDaysFrom", () => {
  it("lands on 09:00 local the given number of days ahead", () => {
    const from = new Date("2026-06-01T22:30:00Z"); // past midnight in Copenhagen
    // 2 June locally, so seven days on is 9 June.
    expect(dueAtDaysFrom(7, from).toISOString()).toBe("2026-06-09T07:00:00.000Z");
  });

  it("counts the current local day as zero", () => {
    const from = new Date("2026-06-01T12:00:00Z");
    expect(dueAtDaysFrom(0, from).toISOString()).toBe("2026-06-01T07:00:00.000Z");
  });

  it("crosses the clock change without drifting off the hour", () => {
    const from = new Date("2026-03-27T12:00:00Z"); // before the change
    const due = dueAtDaysFrom(7, from); // after it
    expect(due.toISOString()).toBe("2026-04-03T07:00:00.000Z");
    expect(formatInZone(due, "HH:mm")).toBe(`${String(DUE_HOUR).padStart(2, "0")}:00`);
  });
});

describe("endOfDayInZone", () => {
  it("is the last instant of the local day", () => {
    expect(endOfDayInZone(new Date("2026-06-01T12:00:00Z")).toISOString()).toBe(
      "2026-06-01T21:59:59.999Z",
    );
  });

  it("uses the local day, not the UTC one, late in the evening", () => {
    // 22:30 UTC is already 2 June in Copenhagen.
    expect(endOfDayInZone(new Date("2026-06-01T22:30:00Z")).toISOString()).toBe(
      "2026-06-02T21:59:59.999Z",
    );
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days in the home's zone, not elapsed hours", () => {
    const evening = new Date("2026-06-01T21:00:00Z"); // 23:00 local, 1 June
    const nextMorning = new Date("2026-06-01T22:30:00Z"); // 00:30 local, 2 June
    expect(calendarDaysBetween(nextMorning, evening)).toBe(1);
  });

  it("is zero across the same local day", () => {
    expect(
      calendarDaysBetween(new Date("2026-06-01T06:00:00Z"), new Date("2026-06-01T20:00:00Z")),
    ).toBe(0);
  });

  it("goes negative for something already past", () => {
    expect(
      calendarDaysBetween(new Date("2026-05-29T07:00:00Z"), new Date("2026-06-01T07:00:00Z")),
    ).toBe(-3);
  });
});

describe("todayInZone", () => {
  it("gives the local date, which can be tomorrow in UTC terms", () => {
    expect(todayInZone(new Date("2026-06-01T22:30:00Z"))).toBe("2026-06-02");
    expect(todayInZone(new Date("2026-06-01T12:00:00Z"))).toBe("2026-06-01");
  });
});

describe("formatInZone", () => {
  it("formats using the home's clock", () => {
    const instant = new Date("2026-06-01T22:30:00Z");
    expect(formatInZone(instant, "yyyy-MM-dd HH:mm")).toBe("2026-06-02 00:30");
  });
});
