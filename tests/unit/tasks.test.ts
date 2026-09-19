import { describe, expect, it } from "vitest";
import {
  FINISHED,
  UNFINISHED,
  isFinished,
  isOneOff,
  isSnoozable,
  repeatLabel,
  snoozedTo,
} from "@/lib/tasks";
import { dueAtDaysFrom, dueAtOn, formatInZone } from "@/lib/time";

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

/*
 * Snoozing is read on the household's clock like every other date, so these fix "now"
 * at a moment and ask about days rather than hours. Both suites run with TZ=UTC, so a
 * calculation that reached for the server's own clock fails here rather than in CI.
 */
const now = new Date("2026-05-05T18:00:00Z");
const due = (date: string) => ({ nextDueAt: dueAtOn(date)! });

describe("isSnoozable", () => {
  const open = { intervalDays: 7, lastCompletedAt: null };

  it("is true of a task due today", () => {
    expect(isSnoozable({ ...open, ...due("2026-05-05") }, now)).toBe(true);
  });

  it("is true of an overdue task, however far behind", () => {
    expect(isSnoozable({ ...open, ...due("2026-05-04") }, now)).toBe(true);
    expect(isSnoozable({ ...open, ...due("2025-11-01") }, now)).toBe(true);
  });

  it("is false of a task not due yet, because tomorrow would be sooner", () => {
    expect(isSnoozable({ ...open, ...due("2026-05-06") }, now)).toBe(false);
    expect(isSnoozable({ ...open, ...due("2026-06-01") }, now)).toBe(false);
  });

  it("is false of a finished one-off, whose date is in the past for ever", () => {
    const finished = { intervalDays: null, lastCompletedAt: new Date("2026-05-01") };
    expect(isSnoozable({ ...finished, ...due("2026-05-01") }, now)).toBe(false);
  });

  it("is true of a one-off nobody has done yet", () => {
    expect(isSnoozable({ intervalDays: null, lastCompletedAt: null, ...due("2026-05-05") }, now)).toBe(
      true,
    );
  });
});

describe("snoozedTo", () => {
  it("is tomorrow morning in the home's zone", () => {
    expect(formatInZone(snoozedTo(due("2026-05-05"), now), "yyyy-MM-dd HH:mm")).toBe(
      "2026-05-06 09:00",
    );
    expect(snoozedTo(due("2026-05-05"), now).toISOString()).toBe(
      dueAtDaysFrom(1, now).toISOString(),
    );
  });

  it("is tomorrow however overdue the task was, not a day after its own date", () => {
    expect(formatInZone(snoozedTo(due("2025-11-01"), now), "yyyy-MM-dd HH:mm")).toBe(
      "2026-05-06 09:00",
    );
  });

  /*
   * The menu is not offered on a task due later, but a card left open on a phone
   * overnight is a card offering it about yesterday — and one press must never pull a
   * date forward.
   */
  it("leaves a date already further out where it is", () => {
    const later = due("2026-06-01");
    expect(snoozedTo(later, now).toISOString()).toBe(later.nextDueAt.toISOString());
  });
});
