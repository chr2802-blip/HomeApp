import { describe, expect, it } from "vitest";
import { CREDIT_DAYS, creditSince, tallyCompletions } from "@/lib/task-credit";
import { calendarDaysBetween } from "@/lib/time";

const alex = { id: "a", name: "Alex", photoId: null };
const sam = { id: "s", name: "Sam", photoId: "p1" };
const mo = { id: "m", name: "Mo", photoId: null };

describe("tallyCompletions", () => {
  it("counts each member, most first, and keeps those who did none", () => {
    const rows = tallyCompletions([{ userId: "s" }, { userId: "s" }, { userId: "a" }], [alex, sam, mo]);

    expect(rows.map((row) => [row.name, row.done])).toEqual([
      ["Sam", 2],
      ["Alex", 1],
      ["Mo", 0],
    ]);
    expect(rows[0]!.photoId).toBe("p1");
  });

  it("breaks a tie on the name, so two people level do not swap places between visits", () => {
    const rows = tallyCompletions([{ userId: "s" }, { userId: "a" }], [sam, alex]);
    expect(rows.map((row) => row.name)).toEqual(["Alex", "Sam"]);
  });

  it("gathers presses by people no longer in the home into one row, last, only when there are any", () => {
    const rows = tallyCompletions([{ userId: null }, { userId: "gone" }, { userId: "a" }], [alex]);
    expect(rows.at(-1)).toEqual({ userId: null, name: null, photoId: null, done: 2 });

    expect(tallyCompletions([{ userId: "a" }], [alex]).some((row) => row.userId === null)).toBe(false);
  });
});

describe("creditSince", () => {
  it("starts the tally CREDIT_DAYS before now", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(calendarDaysBetween(now, creditSince(now))).toBe(CREDIT_DAYS);
  });
});
