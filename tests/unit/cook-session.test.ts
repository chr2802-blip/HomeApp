import { describe, expect, it } from "vitest";

import {
  EMPTY_KITCHEN,
  finishCook,
  isResumable,
  leaveCook,
  parseKitchen,
  prune,
  RESUME_WITHIN_MS,
  showCook,
  startTimer,
  stopTimer,
  turnCook,
  type Kitchen,
} from "@/lib/cook-session";

/**
 * What is on the stove, and what a relaunched app will put a cook back into.
 *
 * The kitchen is read out of the browser's storage, possibly written by an older build,
 * so anything malformed is no kitchen at all rather than a page number from nowhere. One
 * left behind by a dinner abandoned yesterday must not pull somebody into the kitchen
 * the next time they open the app. And — the reason the kitchen exists — walking from one
 * recipe to another must leave the first one's timers running.
 */

const NOW = Date.UTC(2026, 8, 25, 17, 0);
const MINUTE = 60_000;

const lasagne = { recipeId: "lasagne", title: "Lasagne", portions: null, page: 2 };
const rice = { recipeId: "rice", title: "Rice", portions: 6, page: 1 };

describe("parseKitchen", () => {
  it("reads back what was written", () => {
    const kitchen: Kitchen = {
      cooks: [{ ...lasagne, savedAt: NOW }, { ...rice, savedAt: NOW }],
      timers: [{ recipeId: "rice", title: "Rice", step: 0, endsAt: NOW }],
      open: "rice",
    };
    expect(parseKitchen(JSON.stringify(kitchen))).toEqual(kitchen);
  });

  it("reads the single cook an older build kept as that cook, still open, timers and all", () => {
    const raw = JSON.stringify({ recipeId: "r1", page: 3, timers: [{ step: 2, endsAt: NOW }], savedAt: NOW });
    expect(parseKitchen(raw)).toEqual({
      cooks: [{ recipeId: "r1", title: "", portions: null, page: 3, savedAt: NOW }],
      timers: [{ recipeId: "r1", title: "", step: 2, endsAt: NOW }],
      open: "r1",
    });
  });

  it("reads nonsense portions as the recipe as written", () => {
    const raw = JSON.stringify({ cooks: [{ ...lasagne, portions: "six", savedAt: NOW }], timers: [], open: null });
    expect(parseKitchen(raw)?.cooks[0].portions).toBeNull();
  });

  it("is nothing for anything that is not a kitchen", () => {
    for (const raw of [null, "", "not json", "null", "[]", '{"page":1}', '{"cooks":[]}']) {
      expect(parseKitchen(raw)).toBeNull();
    }
    expect(parseKitchen(JSON.stringify({ recipeId: "r1", page: -1, timers: [], savedAt: NOW }))).toBeNull();
  });

  it("drops a malformed cook or timer and keeps the rest", () => {
    const raw = JSON.stringify({
      cooks: [{ ...lasagne, savedAt: NOW }, { recipeId: "", page: 1, savedAt: NOW }, null],
      timers: [
        { recipeId: "lasagne", title: "Lasagne", step: 0, endsAt: NOW },
        { recipeId: "lasagne", step: "x", endsAt: NOW },
        { step: 1, endsAt: NOW },
        null,
      ],
      open: "lasagne",
    });
    const kitchen = parseKitchen(raw);
    expect(kitchen?.cooks.map((cook) => cook.recipeId)).toEqual(["lasagne"]);
    expect(kitchen?.timers).toEqual([{ recipeId: "lasagne", title: "Lasagne", step: 0, endsAt: NOW }]);
  });

  it("does not leave open a recipe that is not on the stove", () => {
    const raw = JSON.stringify({ cooks: [{ ...lasagne, savedAt: NOW }], timers: [], open: "rice" });
    expect(parseKitchen(raw)?.open).toBeNull();
  });
});

describe("isResumable", () => {
  const cook = { ...lasagne, savedAt: NOW };

  it("resumes a cook who was away half an hour", () => {
    const kitchen = { ...EMPTY_KITCHEN, cooks: [{ ...cook, savedAt: NOW - 30 * MINUTE }] };
    expect(isResumable(kitchen, kitchen.cooks[0], NOW)).toBe(true);
  });

  it("does not resume a dinner abandoned hours ago", () => {
    const kitchen = { ...EMPTY_KITCHEN, cooks: [{ ...cook, savedAt: NOW - RESUME_WITHIN_MS - MINUTE }] };
    expect(isResumable(kitchen, kitchen.cooks[0], NOW)).toBe(false);
  });

  it("resumes while a long timer of its own is still counting, however long ago it was started", () => {
    const stale = { ...cook, savedAt: NOW - 4 * 60 * MINUTE };
    const kitchen = {
      cooks: [stale],
      timers: [{ recipeId: "lasagne", title: "Lasagne", step: 1, endsAt: NOW + 30 * MINUTE }],
      open: null,
    };
    expect(isResumable(kitchen, stale, NOW)).toBe(true);
    // Another recipe's timer says nothing about this one.
    expect(isResumable({ ...kitchen, timers: [{ ...kitchen.timers[0], recipeId: "rice" }] }, stale, NOW)).toBe(false);
  });
});

describe("prune", () => {
  it("lets go of stale cooks and long-finished timers, and of an open that pointed at one", () => {
    const kitchen: Kitchen = {
      cooks: [{ ...lasagne, savedAt: NOW - RESUME_WITHIN_MS - MINUTE }, { ...rice, savedAt: NOW }],
      timers: [
        { recipeId: "rice", title: "Rice", step: 0, endsAt: NOW - RESUME_WITHIN_MS - MINUTE },
        { recipeId: "rice", title: "Rice", step: 1, endsAt: NOW - MINUTE },
      ],
      open: "lasagne",
    };
    expect(prune(kitchen, NOW)).toEqual({
      cooks: [{ ...rice, savedAt: NOW }],
      timers: [{ recipeId: "rice", title: "Rice", step: 1, endsAt: NOW - MINUTE }],
      open: null,
    });
  });

  it("hands back the same kitchen when nothing went", () => {
    const kitchen = showCook(EMPTY_KITCHEN, lasagne, NOW);
    expect(prune(kitchen, NOW)).toBe(kitchen);
  });
});

describe("cooking two recipes at once", () => {
  it("keeps the first recipe's timer and page when the cook walks over to the second", () => {
    let kitchen = showCook(EMPTY_KITCHEN, lasagne, NOW);
    kitchen = startTimer(kitchen, { recipeId: "lasagne", title: "Lasagne", step: 1, minutes: 40 }, NOW);

    kitchen = leaveCook(kitchen, "lasagne");
    kitchen = showCook(kitchen, rice, NOW + MINUTE);
    kitchen = startTimer(kitchen, { recipeId: "rice", title: "Rice", step: 0, minutes: 12 }, NOW + MINUTE);

    expect(kitchen.open).toBe("rice");
    expect(kitchen.cooks.map((cook) => [cook.recipeId, cook.page])).toEqual([
      ["lasagne", 2],
      ["rice", 1],
    ]);
    expect(kitchen.timers.map((timer) => [timer.recipeId, timer.endsAt])).toEqual([
      ["lasagne", NOW + 40 * MINUTE],
      ["rice", NOW + 13 * MINUTE],
    ]);
  });

  it("leaves nothing open once the screen is left, and only the screen that was open", () => {
    const kitchen = showCook(EMPTY_KITCHEN, lasagne, NOW);
    expect(leaveCook(kitchen, "rice")).toBe(kitchen);
    expect(leaveCook(kitchen, "lasagne")).toEqual({ ...kitchen, open: null });
  });

  it("restarts a step's timer rather than starting a second one, and stops only that recipe's", () => {
    let kitchen = startTimer(EMPTY_KITCHEN, { recipeId: "lasagne", title: "Lasagne", step: 1, minutes: 10 }, NOW);
    kitchen = startTimer(kitchen, { recipeId: "rice", title: "Rice", step: 1, minutes: 5 }, NOW);
    kitchen = startTimer(kitchen, { recipeId: "lasagne", title: "Lasagne", step: 1, minutes: 10 }, NOW + MINUTE);
    expect(kitchen.timers.map((timer) => [timer.recipeId, timer.endsAt])).toEqual([
      ["rice", NOW + 5 * MINUTE],
      ["lasagne", NOW + 11 * MINUTE],
    ]);
    expect(stopTimer(kitchen, "lasagne", 1).timers.map((timer) => timer.recipeId)).toEqual(["rice"]);
  });

  it("takes a completed recipe off the stove and leaves its timers counting", () => {
    let kitchen = showCook(EMPTY_KITCHEN, lasagne, NOW);
    kitchen = startTimer(kitchen, { recipeId: "lasagne", title: "Lasagne", step: 2, minutes: 40 }, NOW);
    kitchen = finishCook(kitchen, "lasagne");
    expect(kitchen.cooks).toEqual([]);
    expect(kitchen.open).toBeNull();
    expect(kitchen.timers).toHaveLength(1);
  });

  it("keeps a recipe's place in the order when it is shown again", () => {
    let kitchen = showCook(EMPTY_KITCHEN, lasagne, NOW);
    kitchen = showCook(kitchen, rice, NOW);
    kitchen = showCook(kitchen, { ...lasagne, page: 4 }, NOW + MINUTE);
    expect(kitchen.cooks.map((cook) => [cook.recipeId, cook.page])).toEqual([
      ["lasagne", 4],
      ["rice", 1],
    ]);
  });
});

describe("turnCook", () => {
  it("opens a recipe on the stove at the step a timer is for", () => {
    const kitchen = showCook(showCook(EMPTY_KITCHEN, lasagne, NOW), rice, NOW);
    expect(turnCook(kitchen, "lasagne", 3).cooks.map((cook) => [cook.recipeId, cook.page])).toEqual([
      ["lasagne", 3],
      ["rice", 1],
    ]);
  });

  it("leaves a recipe no longer on the stove to start from its ingredients", () => {
    const kitchen = showCook(EMPTY_KITCHEN, rice, NOW);
    expect(turnCook(kitchen, "lasagne", 3)).toBe(kitchen);
  });
});
