import { describe, expect, it } from "vitest";
import { FINISHED, UNFINISHED, isFinished, isOneOff, repeatLabel } from "@/lib/tasks";

const recurring = { intervalDays: 7, lastCompletedAt: null };
const recurringDone = { intervalDays: 7, lastCompletedAt: new Date("2026-03-01") };
const oneOff = { intervalDays: null, lastCompletedAt: null };
const oneOffDone = { intervalDays: null, lastCompletedAt: new Date("2026-03-01") };

describe("isOneOff", () => {
  it("is the absence of an interval, and nothing else", () => {
    expect(isOneOff(oneOff)).toBe(true);
    expect(isOneOff(oneOffDone)).toBe(true);
    expect(isOneOff(recurring)).toBe(false);
  });
});

describe("isFinished", () => {
  it("is a one-off that has been done", () => {
    expect(isFinished(oneOffDone)).toBe(true);
  });

  it("is not a one-off still waiting to be done", () => {
    expect(isFinished(oneOff)).toBe(false);
  });

  it("is never a recurring task, however many times it has been completed", () => {
    // Completing a recurring task schedules the next one, so "done" is only ever the
    // last time round — the task itself is still on the household's list.
    expect(isFinished(recurring)).toBe(false);
    expect(isFinished(recurringDone)).toBe(false);
  });
});

describe("repeatLabel", () => {
  it("names the interval for a recurring task", () => {
    expect(repeatLabel({ intervalDays: 7 })).toBe("Every 7 days");
    expect(repeatLabel({ intervalDays: 1 })).toBe("Every 1 days");
  });

  it("says a one-off has no rhythm rather than naming one", () => {
    expect(repeatLabel({ intervalDays: null })).toBe("One-off");
  });
});

describe("the query filters", () => {
  it("select opposite sets", () => {
    expect(UNFINISHED).toEqual({ NOT: FINISHED });
  });

  /*
   * The reminder job carries an OR of its own and spreads UNFINISHED beside it. Written
   * as the equivalent OR, this filter would replace that one and the job would remind
   * about every due task every single day.
   */
  it("leave a caller's own OR alone when spread beside it", () => {
    const where = { OR: [{ lastNotifiedAt: null }], ...UNFINISHED };

    expect(where.OR).toEqual([{ lastNotifiedAt: null }]);
    expect(where.NOT).toEqual(FINISHED);
  });
});
