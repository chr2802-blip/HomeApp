import { describe, expect, it } from "vitest";
import { formatAverage, ratingSummary, readHearts } from "@/lib/rating";

describe("ratingSummary", () => {
  it("has no score for a recipe nobody has rated", () => {
    expect(ratingSummary([])).toBeNull();
  });

  it("averages every rating, several from one person included", () => {
    expect(ratingSummary([{ hearts: 5 }, { hearts: 4 }, { hearts: 4 }])).toEqual({
      average: 13 / 3,
      count: 3,
    });
  });
});

describe("formatAverage", () => {
  it("writes one decimal in the household's own separator", () => {
    expect(formatAverage(13 / 3, "EN")).toBe("4.3");
    expect(formatAverage(13 / 3, "DA")).toBe("4,3");
  });

  it("writes a whole number without a trailing zero", () => {
    expect(formatAverage(4, "DA")).toBe("4");
    expect(formatAverage(4.96, "EN")).toBe("5");
  });
});

describe("readHearts", () => {
  it.each([
    ["1", 1],
    ["5", 5],
    ["0", null],
    ["6", null],
    ["2.5", null],
    [null, null],
  ])("reads %j as %j", (value, hearts) => {
    expect(readHearts(value)).toBe(hearts);
  });
});
