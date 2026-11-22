import { describe, expect, it } from "vitest";
import { pageMotion } from "@/lib/page-motion";
import { backHref } from "@/lib/back-link";
import { SETTINGS_PATHS } from "@/lib/settings-tabs";
import { followFinger, letsGoBack, sidewaysIntent, startsAtEdge, swipeIntent } from "@/lib/edge-swipe";

// The app's own tabs and sections, written out here so a reorder of the bar is a choice
// this test is told about.
const TABS = [["/dashboard"], ["/recipes", "/meals"], ["/lists", "/pantry"], ["/tasks"]];
const SETTINGS = ["/settings", "/settings/members", "/settings/categories", "/settings/done", "/settings/status"];
const SECTIONS = [["/recipes", "/meals"], ["/lists", "/pantry"], SETTINGS];
const motion = (from: string, to: string) => pageMotion(from, to, TABS, SECTIONS);

describe("pageMotion", () => {
  it("brings a tab in from the side it sits on in the tab bar", () => {
    expect(motion("/dashboard", "/lists")).toBe("forward");
    expect(motion("/tasks", "/recipes")).toBe("backward");
    // From deep inside one tab to another is still a change of tab.
    expect(motion("/lists/abc", "/tasks")).toBe("forward");
  });

  it("steps sideways between the pages of one section, the way the pill moves", () => {
    expect(motion("/recipes", "/meals")).toBe("forward");
    expect(motion("/pantry", "/lists")).toBe("backward");
    expect(motion("/settings", "/settings/done")).toBe("forward");
    expect(motion("/settings/status", "/settings/members")).toBe("backward");
  });

  it("opens a page deeper in a tab and closes back out of it", () => {
    expect(motion("/lists", "/lists/abc")).toBe("open");
    expect(motion("/pantry", "/lists/abc")).toBe("open");
    expect(motion("/recipes/abc/edit", "/recipes/abc")).toBe("close");
  });

  it("opens a page outside the tabs over wherever one was, and closes back into a tab", () => {
    expect(motion("/lists", "/settings")).toBe("open");
    expect(motion("/admin", "/admin/homes")).toBe("open");
    expect(motion("/admin/homes", "/admin")).toBe("close");
    expect(motion("/profile", "/dashboard")).toBe("close");
  });

  it("brings nothing in for the same page, or a sideways step inside a tab that is no section", () => {
    expect(motion("/lists", "/lists")).toBeNull();
    expect(motion("/lists/a", "/lists/b")).toBeNull();
  });
});

it("knows Settings' tabs as written above", () => {
  expect(SETTINGS_PATHS).toEqual(SETTINGS);
});

describe("backHref", () => {
  it("has no arrow on a tab's own page or a section's", () => {
    for (const root of ["/dashboard", "/lists", "/pantry", "/tasks", "/meals", "/recipes"]) {
      expect(backHref(root)).toBeNull();
    }
  });

  it("goes one segment up, and to the dashboard from a page outside the tabs", () => {
    expect(backHref("/lists/abc")).toBe("/lists");
    expect(backHref("/recipes/abc/cook")).toBe("/recipes/abc");
    expect(backHref("/settings")).toBe("/dashboard");
    // Settings' tabs sit side by side: each leads out of Settings, not to the first tab.
    for (const tab of SETTINGS) expect(backHref(tab)).toBe("/dashboard");
    // Admin is reached from the header's menu now, so it has a way back like Settings.
    expect(backHref("/admin")).toBe("/dashboard");
  });
});

describe("the swipes", () => {
  it("counts only a touch that starts at the very edge as a way back", () => {
    expect(startsAtEdge(10)).toBe(true);
    expect(startsAtEdge(60)).toBe(false);
  });

  it("decides nothing until the finger has moved, and reads only rightwards as back", () => {
    expect(swipeIntent(3, 2)).toBe("undecided");
    expect(swipeIntent(30, 4)).toBe("back");
    expect(swipeIntent(-30, 4)).toBe("other");
    expect(swipeIntent(5, 30)).toBe("other");
  });

  it("reads a section swipe either way, and leaves a scroll alone", () => {
    expect(sidewaysIntent(-30, 5)).toBe("left");
    expect(sidewaysIntent(30, 5)).toBe("right");
    expect(sidewaysIntent(20, 20)).toBe("other");
  });

  it("goes when let go far enough or fast enough, and not on a twitch", () => {
    expect(letsGoBack(140, 390, 0)).toBe(true);
    expect(letsGoBack(60, 390, 0.8)).toBe(true);
    expect(letsGoBack(20, 390, 2)).toBe(false);
    expect(followFinger(-40)).toBe(0);
  });
});
