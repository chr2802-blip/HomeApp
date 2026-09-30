import { describe, expect, it } from "vitest";
import { dayLine, greeting, partOfDay } from "@/lib/greeting";
import { seasonOn } from "@/lib/season";

/** An instant on the household's clock (Copenhagen is UTC+2 in summer, +1 in winter). */
const at = (iso: string) => new Date(iso);

describe("the dashboard's greeting", () => {
  it("follows the household's clock rather than the server's", () => {
    // 05:30 UTC is 07:30 in Copenhagen: morning there, still night on the server.
    expect(partOfDay(at("2026-06-10T05:30:00Z"))).toBe("morning");
    expect(partOfDay(at("2026-06-10T11:00:00Z"))).toBe("afternoon");
    expect(partOfDay(at("2026-06-10T17:00:00Z"))).toBe("evening");
    expect(partOfDay(at("2026-06-10T21:30:00Z"))).toBe("night");
  });

  it("greets in the home's language", () => {
    expect(greeting("Anna", at("2026-06-10T05:30:00Z"), "EN")).toBe("Good morning, Anna");
    expect(greeting("Anna", at("2026-06-10T17:00:00Z"), "DA")).toBe("Godaften, Anna");
  });
});

describe("the line under the greeting", () => {
  const now = at("2026-06-10T10:00:00Z");

  it("talks about tonight's dinner when there is one", () => {
    expect(dayLine({ dish: "Lasagne", dueCount: 3 }, now, "EN")).toContain("Lasagne");
  });

  it("is never cheerful about a day with work waiting", () => {
    const busy = dayLine({ dish: null, dueCount: 2 }, now, "EN");
    const calm = dayLine({ dish: null, dueCount: 0 }, now, "EN");
    expect(busy).not.toBe(calm);
    expect(busy).not.toMatch(/kettle|quiet|calm/i);
  });

  it("says the same thing all day and something else tomorrow", () => {
    const morning = dayLine({ dish: null, dueCount: 0 }, at("2026-06-10T05:00:00Z"), "EN");
    const evening = dayLine({ dish: null, dueCount: 0 }, at("2026-06-10T20:00:00Z"), "EN");
    const tomorrow = dayLine({ dish: null, dueCount: 0 }, at("2026-06-11T10:00:00Z"), "EN");
    expect(evening).toBe(morning);
    expect(tomorrow).not.toBe(morning);
  });

  it("dresses up a quiet festive day only for a home that asked for it", () => {
    const christmasEve = at("2026-12-24T10:00:00Z");
    expect(dayLine({ dish: null, dueCount: 0, seasonal: true }, christmasEve, "EN")).toContain("🎄");
    expect(dayLine({ dish: null, dueCount: 0 }, christmasEve, "EN")).not.toContain("🎄");
    expect(dayLine({ dish: null, dueCount: 1, seasonal: true }, christmasEve, "EN")).not.toContain("🎄");
  });
});

describe("the season", () => {
  it.each([
    ["2026-12-01", "christmas"],
    ["2026-12-26", "christmas"],
    ["2026-12-31", "newYear"],
    ["2027-01-01", "newYear"],
    ["2027-01-02", "winter"],
    ["2026-10-31", "halloween"],
    ["2026-10-24", "autumn"],
    ["2026-04-01", "spring"],
    ["2026-07-15", "summer"],
    ["2026-09-30", "autumn"],
  ])("puts %s in %s", (day, season) => {
    expect(seasonOn(day)).toBe(season);
  });
});
