import { describe, expect, it } from "vitest";
import {
  dayAndMonth,
  leftoversChoice,
  leftoversDay,
  leftoversHeading,
  leftoversLabel,
  weekLabel,
  weekdayName,
} from "@/lib/meals";
import { weekDays } from "@/lib/time";

/*
 * Read on the household's clock, like every other date in the app. Both suites run with
 * TZ=UTC, so a label that reached for the server's own zone fails on the machine that
 * wrote it rather than on somebody's phone.
 */

describe("weekdayName", () => {
  it("names the day the row is for", () => {
    expect(weekdayName("2026-06-01", "EN")).toBe("Monday");
    expect(weekdayName("2026-06-07", "EN")).toBe("Sunday");
  });

  it("reads in the household's own language", () => {
    expect(weekdayName("2026-06-01", "DA")).toBe("mandag");
    expect(weekdayName("2026-06-07", "DA")).toBe("søndag");
  });
});

describe("dayAndMonth", () => {
  it("leaves the year out, because the week above it has already said which", () => {
    expect(dayAndMonth("2026-06-01", "EN")).toBe("1 Jun");
    expect(dayAndMonth("2026-12-25", "EN")).toBe("25 Dec");
  });

  it("reads in the household's own language", () => {
    expect(dayAndMonth("2026-06-01", "DA")).toBe("1. jun.");
    expect(dayAndMonth("2026-12-25", "DA")).toBe("25. dec.");
  });
});

describe("weekLabel", () => {
  it("says the month once for a week inside one", () => {
    expect(weekLabel(weekDays("2026-06-01"), "EN")).toBe("1–7 Jun");
  });

  it("says both months for a week that straddles them", () => {
    expect(weekLabel(weekDays("2026-06-29"), "EN")).toBe("29 Jun – 5 Jul");
  });

  it("says both years for the week that straddles those", () => {
    expect(weekLabel(weekDays("2026-12-28"), "EN")).toBe("28 Dec 2026 – 3 Jan 2027");
  });

  it("reads in the household's own language", () => {
    expect(weekLabel(weekDays("2026-06-01"), "DA")).toBe("1–7. jun.");
  });
});

describe("leftovers choices", () => {
  it("carries the day being eaten again, because the word alone says no dinner", () => {
    expect(leftoversDay(leftoversChoice("2026-06-02"))).toBe("2026-06-02");
  });

  it("does not mistake a recipe id for one", () => {
    // Every other value on the field is a recipe id or one of the two words, and the
    // reader has to tell them apart without knowing which it was handed.
    expect(leftoversDay("clx123abc")).toBeNull();
    expect(leftoversDay("out")).toBeNull();
    expect(leftoversDay("")).toBeNull();
  });
});

describe("leftoversLabel", () => {
  it("names the meal and the day it was cooked", () => {
    expect(leftoversLabel({ day: "2026-06-02", title: "Lasagne" }, "EN")).toBe(
      "Leftovers — Tuesday's Lasagne",
    );
  });

  it("still says leftovers where the day it pointed at is gone", () => {
    // The pointer reaching nothing — the day cleared, or cooked in a week not on screen
    // — leaves the household eating leftovers of something, which is the half the row
    // still knows and the half that matters at six o'clock.
    expect(leftoversLabel(null, "EN")).toBe(leftoversHeading("EN"));
  });

  it("reads in the household's own language, with a genitive and no apostrophe", () => {
    expect(leftoversLabel({ day: "2026-06-02", title: "Lasagne" }, "DA")).toBe(
      "Rester — tirsdags Lasagne",
    );
  });
});
