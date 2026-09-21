import { describe, expect, it } from "vitest";
import { MONTHLY_LIMIT_DKK, costMicros, formatDkk } from "@/lib/ai-usage";

describe("costMicros", () => {
  it("prices a call at Sonnet 5's own rate, input and output apart", () => {
    // $2/MTok in, $10/MTok out: a million of each is $2 and $10, in millionths of a dollar.
    expect(costMicros("claude-sonnet-5", 1_000_000, 0)).toBe(2_000_000);
    expect(costMicros("claude-sonnet-5", 0, 1_000_000)).toBe(10_000_000);
  });

  it("rounds once, to the nearest millionth of a dollar", () => {
    expect(costMicros("claude-sonnet-5", 3000, 1500)).toBe(21_000);
  });

  it("charges nothing for a model this app has never priced", () => {
    // Silence rather than a guess: a typo in a model name should not bill it at the
    // cost of whichever model happens to sort first.
    expect(costMicros("some-future-model", 10_000, 10_000)).toBe(0);
  });
});

describe("formatDkk", () => {
  // da-DK's currency format sits the unit behind a non-breaking space (U+00A0), not an
  // ordinary one — matched here so a rendering that lost that space would fail loudly
  // rather than looking identical in every terminal that prints this file.
  it("keeps two decimals below 10 kr., the way a single call actually costs", () => {
    expect(formatDkk(0.14)).toBe("0,14 kr.");
    expect(formatDkk(0)).toBe("0 kr.");
  });

  it("drops the decimals once the amount is a home's own limit's size", () => {
    expect(formatDkk(35)).toBe("35 kr.");
    expect(Math.round(MONTHLY_LIMIT_DKK)).toBeGreaterThan(10);
  });
});
