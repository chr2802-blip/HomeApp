import { describe, expect, it } from "vitest";
import {
  DEFAULT_PINS,
  PINNABLE_TABS,
  PIN_SLOTS,
  litPlace,
  pinInPlaceOf,
  readPins,
  swapPins,
  tabOf,
} from "@/lib/nav-tabs";

describe("readPins", () => {
  it("gives somebody who never chose the defaults", () => {
    expect(readPins([])).toEqual(DEFAULT_PINS);
    expect(readPins(null)).toEqual(DEFAULT_PINS);
    expect(readPins(undefined)).toEqual(DEFAULT_PINS);
  });

  it("keeps a choice as made, in its order", () => {
    expect(readPins(["tasks", "food"])).toEqual(["tasks", "food"]);
  });

  it("drops what it does not know and what repeats, and fills from the defaults", () => {
    expect(readPins(["gone", "tasks", "tasks", 7])).toEqual(["tasks", "food"]);
    expect(readPins(["food", "food"])).toEqual(["food", "lists"]);
  });

  it("never pins Home, which is always there", () => {
    expect(readPins(["dashboard", "tasks"])).toEqual(["tasks", "food"]);
  });

  it("always answers exactly the bar's places, all of them tabs that can be pinned", () => {
    for (const stored of [[], ["tasks"], ["lists", "tasks", "food"], ["x", "y", "z"]]) {
      const pins = readPins(stored);
      expect(pins).toHaveLength(PIN_SLOTS);
      expect(new Set(pins).size).toBe(PIN_SLOTS);
      for (const pin of pins) expect(PINNABLE_TABS).toContain(pin);
    }
  });
});

describe("changing the pins", () => {
  it("puts a tab in the place of the one it replaces", () => {
    expect(pinInPlaceOf(["food", "lists"], "tasks", "food")).toEqual(["tasks", "lists"]);
    expect(pinInPlaceOf(["food", "lists"], "tasks", "lists")).toEqual(["food", "tasks"]);
  });

  it("leaves the pins alone for a tab already pinned or a place it does not hold", () => {
    expect(pinInPlaceOf(["food", "lists"], "lists", "food")).toEqual(["food", "lists"]);
    expect(pinInPlaceOf(["food", "lists"], "tasks", "tasks")).toEqual(["food", "lists"]);
  });

  it("swaps the two places", () => {
    expect(swapPins(["food", "lists"])).toEqual(["lists", "food"]);
  });
});

describe("litPlace", () => {
  const pins = ["food", "lists"] as const;

  it("lights Home on the dashboard", () => {
    expect(litPlace("/dashboard", pins)).toBe("dashboard");
  });

  it("lights a pinned tab on any of its pages", () => {
    expect(litPlace("/recipes", pins)).toBe("food");
    expect(litPlace("/meals", pins)).toBe("food");
    expect(litPlace("/recipes/abc/cook", pins)).toBe("food");
    expect(litPlace("/pantry", pins)).toBe("lists");
  });

  it("lights the menu for a tab not in the bar", () => {
    expect(litPlace("/tasks", pins)).toBe("menu");
    expect(litPlace("/tasks", ["tasks", "food"])).toBe("tasks");
  });

  it("lights the menu for a page outside every tab", () => {
    expect(litPlace("/settings", pins)).toBe("menu");
    expect(litPlace("/profile", pins)).toBe("menu");
  });

  it("does not take a path that merely starts the same for the tab", () => {
    expect(tabOf("/listsomething")).toBeNull();
  });
});
