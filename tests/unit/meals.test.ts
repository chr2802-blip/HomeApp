import { describe, expect, it } from "vitest";
import { dayAndMonth, weekLabel, weekdayName } from "@/lib/meals";
import { weekDays } from "@/lib/time";

/*
 * Read on the household's clock, like every other date in the app. Both suites run with
 * TZ=UTC, so a label that reached for the server's own zone fails on the machine that
 * wrote it rather than on somebody's phone.
 */

describe("weekdayName", () => {
  it("names the day the row is for", () => {
    expect(weekdayName("2026-06-01")).toBe("Monday");
    expect(weekdayName("2026-06-07")).toBe("Sunday");
  });
});

describe("dayAndMonth", () => {
  it("leaves the year out, because the week above it has already said which", () => {
    expect(dayAndMonth("2026-06-01")).toBe("1 Jun");
    expect(dayAndMonth("2026-12-25")).toBe("25 Dec");
  });
});

describe("weekLabel", () => {
  it("says the month once for a week inside one", () => {
    expect(weekLabel(weekDays("2026-06-01"))).toBe("1–7 Jun");
  });

  it("says both months for a week that straddles them", () => {
    expect(weekLabel(weekDays("2026-06-29"))).toBe("29 Jun – 5 Jul");
  });

  it("says both years for the week that straddles those", () => {
    expect(weekLabel(weekDays("2026-12-28"))).toBe("28 Dec 2026 – 3 Jan 2027");
  });
});
