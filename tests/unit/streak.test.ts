import { describe, expect, it } from "vitest";
import { streakLine } from "@/lib/streak";

/**
 * What the streak says, which is the whole of the feature on the page.
 *
 * The number behind it is a count of rows; this is the sentence a household actually
 * reads, and it is the part that can be wrong in a way nothing else catches — a run of
 * one called a streak, or a live run that forgets to say the current week is still
 * empty, is a working feature saying the wrong thing.
 */
describe("streakLine", () => {
  it("does not call a single week a run", () => {
    expect(streakLine({ weeks: 1, thisWeek: 1 })).toBe(
      "🔥 A list cleared · 1 list cleared this week",
    );
    expect(streakLine({ weeks: 1, thisWeek: 0 })).toBe(
      "🔥 A list cleared last week",
    );
  });

  it("counts the weeks once there is a run of them", () => {
    expect(streakLine({ weeks: 4, thisWeek: 2 })).toBe(
      "🔥 4 weeks running · 2 lists cleared this week",
    );
  });

  it("says when a live run has nothing in the week yet", () => {
    // The part of a streak that is actually at stake: the week is not over, and this
    // is the only place the page says so.
    expect(streakLine({ weeks: 3, thisWeek: 0 })).toBe(
      "🔥 3 weeks running · nothing cleared yet this week",
    );
  });
});
