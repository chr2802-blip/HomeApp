import { describe, expect, it } from "vitest";
import { pagerAddress, pagerIndex, pagerUrl, tabOf } from "@/lib/pager";

const HREFS = ["/baby", "/baby?tab=charts"];

describe("a pager's address", () => {
  it("names the first page by no tab at all", () => {
    expect(tabOf("/baby")).toBeNull();
    expect(tabOf("/baby?tab=charts")).toBe("charts");
  });

  it("reads anything unknown as the first page", () => {
    expect(pagerIndex(HREFS, null)).toBe(0);
    expect(pagerIndex(HREFS, "charts")).toBe(1);
    expect(pagerIndex(HREFS, "nonsense")).toBe(0);
  });

  it("turns the tab and keeps everything else in the address", () => {
    expect(pagerUrl("http://x/baby?day=2026-11-20", HREFS[1]!)).toBe("/baby?day=2026-11-20&tab=charts");
    expect(pagerUrl("http://x/baby?tab=charts&period=month", HREFS[0]!)).toBe("/baby?period=month");
  });

  it("matches a segment's href however the address got its tab", () => {
    expect(pagerAddress("/baby", null)).toBe("/baby");
    expect(pagerAddress("/baby", "charts")).toBe(HREFS[1]);
  });
});
