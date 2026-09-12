import { describe, expect, it } from "vitest";
import { dueLabel, dueTone } from "@/lib/due";

const NOW = new Date("2026-03-10T12:00:00");
const at = (iso: string) => new Date(iso);

describe("dueLabel", () => {
  it("calls out today and tomorrow", () => {
    expect(dueLabel(at("2026-03-10T09:00:00"), NOW)).toBe("Due today");
    expect(dueLabel(at("2026-03-11T09:00:00"), NOW)).toBe("Due tomorrow");
  });

  it("counts overdue days, with correct singular and plural", () => {
    expect(dueLabel(at("2026-03-09T09:00:00"), NOW)).toBe("1 day overdue");
    expect(dueLabel(at("2026-03-07T09:00:00"), NOW)).toBe("3 days overdue");
  });

  it("shows a date further ahead", () => {
    expect(dueLabel(at("2026-03-14T09:00:00"), NOW)).toBe("Due 14 Mar");
  });

  it("compares calendar days, not elapsed hours", () => {
    // Earlier in the clock but the same calendar day: still "today", not overdue.
    expect(dueLabel(at("2026-03-10T09:00:00"), at("2026-03-10T23:30:00"))).toBe("Due today");
    // Only 10 hours ahead, but it is the next calendar day.
    expect(dueLabel(at("2026-03-11T09:00:00"), at("2026-03-10T23:00:00"))).toBe("Due tomorrow");
  });
});

describe("dueTone", () => {
  it("flags overdue red, today amber and later neutral", () => {
    expect(dueTone(at("2026-03-09T09:00:00"), NOW)).toBe("red");
    expect(dueTone(at("2026-03-10T09:00:00"), NOW)).toBe("amber");
    expect(dueTone(at("2026-03-12T09:00:00"), NOW)).toBe("neutral");
  });
});
