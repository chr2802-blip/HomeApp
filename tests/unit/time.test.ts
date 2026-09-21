import { describe, expect, it } from "vitest";
import {
  DUE_HOUR,
  calendarDaysBetween,
  dueAtDaysFrom,
  dueAtOn,
  endOfDayInZone,
  formatDayInZone,
  formatInZone,
  monthStartInstant,
  nextWeekStart,
  previousWeekStart,
  todayInZone,
  weekDays,
  weekStartInZone,
  weekStartInstant,
  weekStartOn,
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

/**
 * The household's week.
 *
 * A streak is a run of weeks with no gap in it, so the whole feature rests on "the week
 * before this one" being a question with one answer. These run under TZ=UTC, as both
 * suites do, so a Monday that is still Sunday in UTC is the case that fails here rather
 * than in Copenhagen on a Sunday evening.
 */
describe("weekStartInZone", () => {
  it("gives the Monday of the week the home is in", () => {
    // A Wednesday, and the Sunday that closes the same week.
    expect(weekStartInZone(new Date("2026-06-03T12:00:00Z"))).toBe(
      "2026-06-01",
    );
    expect(weekStartInZone(new Date("2026-06-07T12:00:00Z"))).toBe(
      "2026-06-01",
    );
  });

  it("turns the week over on the home's Monday, not on UTC's", () => {
    // 00:30 on Monday 8 June in Copenhagen is still Sunday evening in UTC. The week
    // the household is living in is the new one.
    expect(weekStartInZone(new Date("2026-06-07T22:30:00Z"))).toBe(
      "2026-06-08",
    );
  });
});

describe("previousWeekStart", () => {
  it("steps back one Monday", () => {
    expect(previousWeekStart("2026-06-08")).toBe("2026-06-01");
  });

  it("crosses a month, a year and a change of the clocks without drifting", () => {
    expect(previousWeekStart("2026-03-02")).toBe("2026-02-23");
    expect(previousWeekStart("2027-01-04")).toBe("2026-12-28");
    // The clocks go forward in Europe on the last Sunday of March — the Monday after
    // is still seven days after the Monday before it.
    expect(previousWeekStart("2026-03-30")).toBe("2026-03-23");
    expect(previousWeekStart("2026-11-02")).toBe("2026-10-26");
  });

  it("walks back through a year without ever missing or repeating a week", () => {
    const seen = new Set<string>();
    let week = weekStartInZone(new Date("2026-06-03T12:00:00Z"));

    for (let step = 0; step < 52; step += 1) {
      expect(seen.has(week)).toBe(false);
      seen.add(week);
      const earlier = previousWeekStart(week);
      // Each step is exactly seven days, counted the way the household counts them.
      expect(
        calendarDaysBetween(weekStartInstant(week), weekStartInstant(earlier)),
      ).toBe(7);
      week = earlier;
    }
  });
});

describe("nextWeekStart", () => {
  it("steps forward one Monday, through a month, a year and the clocks", () => {
    expect(nextWeekStart("2026-06-01")).toBe("2026-06-08");
    expect(nextWeekStart("2026-02-23")).toBe("2026-03-02");
    expect(nextWeekStart("2026-12-28")).toBe("2027-01-04");
    expect(nextWeekStart("2026-03-23")).toBe("2026-03-30");
    expect(nextWeekStart("2026-10-26")).toBe("2026-11-02");
  });

  it("undoes previousWeekStart, which is what the week's own bounds rest on", () => {
    for (const week of ["2026-06-01", "2026-03-30", "2027-01-04"]) {
      expect(previousWeekStart(nextWeekStart(week))).toBe(week);
      expect(nextWeekStart(previousWeekStart(week))).toBe(week);
    }
  });
});

describe("weekStartInstant", () => {
  it("is midnight on that Monday in the home's zone", () => {
    // Summer time: midnight in Copenhagen is 22:00 the day before in UTC.
    expect(weekStartInstant("2026-06-01").toISOString()).toBe(
      "2026-05-31T22:00:00.000Z",
    );
    // And an hour later off it.
    expect(weekStartInstant("2026-12-07").toISOString()).toBe(
      "2026-12-06T23:00:00.000Z",
    );
  });
});

describe("monthStartInstant", () => {
  it("is midnight on the first in the home's zone", () => {
    // Summer time: midnight in Copenhagen is 22:00 the day before in UTC.
    expect(monthStartInstant(new Date("2026-06-15T12:00:00Z")).toISOString()).toBe(
      "2026-05-31T22:00:00.000Z",
    );
    // And an hour later off it.
    expect(monthStartInstant(new Date("2026-12-20T12:00:00Z")).toISOString()).toBe(
      "2026-11-30T23:00:00.000Z",
    );
  });

  it("does not move for the first of the month itself", () => {
    expect(monthStartInstant(new Date("2026-06-01T10:00:00Z")).toISOString()).toBe(
      "2026-05-31T22:00:00.000Z",
    );
  });
});

describe("weekDays", () => {
  it("is the seven days from that Monday, Monday first", () => {
    expect(weekDays("2026-06-01")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
  });

  it("counts calendar days through a clock change, not 24-hour steps", () => {
    // The clocks go forward on Sunday 29 March 2026, making that day 23 hours long.
    // Counted in hours, the last day of this week would come out as the 28th twice.
    expect(weekDays("2026-03-23")).toEqual([
      "2026-03-23",
      "2026-03-24",
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
    ]);
  });

  it("ends the day before the next week starts, with no day said twice", () => {
    for (const week of ["2026-01-05", "2026-03-23", "2026-10-26", "2026-12-28"]) {
      const days = weekDays(week);

      expect(days).toHaveLength(7);
      expect(new Set(days).size).toBe(7);
      expect(days[0]).toBe(week);
      // Sunday, then Monday: the seam between two weeks is one calendar day wide,
      // counted the way the household counts them.
      expect(
        calendarDaysBetween(weekStartInstant(nextWeekStart(week)), weekStartInstant(days[6]!)),
      ).toBe(1);
    }
  });
});

describe("weekStartOn", () => {
  it("answers with the Monday of the week a day falls in", () => {
    expect(weekStartOn("2026-06-01")).toBe("2026-06-01");
    expect(weekStartOn("2026-06-04")).toBe("2026-06-01");
    // Sunday belongs to the week it ends, not the one it is next to.
    expect(weekStartOn("2026-06-07")).toBe("2026-06-01");
    expect(weekStartOn("2026-06-08")).toBe("2026-06-08");
  });

  it("refuses anything that is not a real date, so a bad URL has nothing to draw", () => {
    expect(weekStartOn("")).toBeNull();
    expect(weekStartOn("next week")).toBeNull();
    expect(weekStartOn("2026-02-31")).toBeNull();
    expect(weekStartOn("2026-13-01")).toBeNull();
  });
});

describe("formatDayInZone", () => {
  it("prints the day it was given, never the one before it", () => {
    expect(formatDayInZone("2026-06-01", "EEEE")).toBe("Monday");
    expect(formatDayInZone("2026-06-01", "d MMM")).toBe("1 Jun");
    // The day the clocks go forward: read at midnight this would be 23:00 the evening
    // before in a zone an hour behind, and print the wrong weekday.
    expect(formatDayInZone("2026-03-29", "EEEE d MMM")).toBe("Sunday 29 Mar");
  });
});
