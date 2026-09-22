import { describe, expect, it } from "vitest";
import { dueLabel, dueTone } from "@/lib/due";

/**
 * Every instant here is written in UTC and every expectation is what the household
 * should read on its own clock, so these hold wherever the tests happen to run.
 * March dates are winter time in Denmark (UTC+1), June dates summer time (UTC+2).
 */
const at = (iso: string) => new Date(iso);

// 12:00 on 10 March, Copenhagen.
const NOW = at("2026-03-10T11:00:00Z");
// 09:00 on a given March day, Copenhagen.
const marchDueAt = (day: string) => at(`2026-03-${day}T08:00:00Z`);

describe("dueLabel", () => {
  it("calls out today and tomorrow", () => {
    expect(dueLabel(marchDueAt("10"), "EN", NOW)).toBe("Due today");
    expect(dueLabel(marchDueAt("11"), "EN", NOW)).toBe("Due tomorrow");
  });

  it("counts overdue days, with correct singular and plural", () => {
    expect(dueLabel(marchDueAt("09"), "EN", NOW)).toBe("1 day overdue");
    expect(dueLabel(marchDueAt("07"), "EN", NOW)).toBe("3 days overdue");
  });

  it("shows a date further ahead", () => {
    expect(dueLabel(marchDueAt("14"), "EN", NOW)).toBe("Due 14 Mar");
  });

  it("compares calendar days, not elapsed hours", () => {
    // 23:30 local, same day as the 09:00 due time.
    expect(dueLabel(marchDueAt("10"), "EN", at("2026-03-10T22:30:00Z"))).toBe("Due today");
    // 23:00 local on the 10th, looking at the 11th — ten hours, but the next day.
    expect(dueLabel(marchDueAt("11"), "EN", at("2026-03-10T22:00:00Z"))).toBe("Due tomorrow");
  });

  it("uses the household's day, not the server's", () => {
    // 00:30 on 2 June in Copenhagen, still 1 June in UTC. A task due at 09:00 that
    // morning is due today; counting in UTC would wrongly say tomorrow.
    const justAfterLocalMidnight = at("2026-06-01T22:30:00Z");
    const dueThatMorning = at("2026-06-02T07:00:00Z");

    expect(dueLabel(dueThatMorning, "EN", justAfterLocalMidnight)).toBe("Due today");
  });

  it("formats the date on the household's clock", () => {
    // 00:30 local on 2 June, so it reads as the 2nd rather than the 1st.
    expect(dueLabel(at("2026-06-05T22:30:00Z"), "EN", NOW)).toBe("Due 6 Jun");
  });

  it("reads in the household's own language", () => {
    expect(dueLabel(marchDueAt("10"), "DA", NOW)).toBe("Forfalder i dag");
    expect(dueLabel(marchDueAt("11"), "DA", NOW)).toBe("Forfalder i morgen");
    expect(dueLabel(marchDueAt("09"), "DA", NOW)).toBe("1 dag over tid");
    expect(dueLabel(marchDueAt("07"), "DA", NOW)).toBe("3 dage over tid");
    expect(dueLabel(marchDueAt("14"), "DA", NOW)).toBe("Forfalder 14. mar.");
  });
});

describe("dueTone", () => {
  it("flags overdue red, today amber and later neutral", () => {
    expect(dueTone(marchDueAt("09"), NOW)).toBe("red");
    expect(dueTone(marchDueAt("10"), NOW)).toBe("amber");
    expect(dueTone(marchDueAt("12"), NOW)).toBe("neutral");
  });

  it("turns amber on the household's day boundary", () => {
    const justAfterLocalMidnight = at("2026-06-01T22:30:00Z");
    expect(dueTone(at("2026-06-02T07:00:00Z"), justAfterLocalMidnight)).toBe("amber");
  });
});
