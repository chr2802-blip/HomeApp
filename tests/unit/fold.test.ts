import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOLD_MS } from "@/components/use-fold";

/**
 * A fold's panel is unmounted (or hidden) by a timer, not by `animationend`, so the timer
 * and the keyframes have to agree. Shorter, and a shutting panel vanishes half way down;
 * longer, and an opening one sits clipped after it has finished moving.
 */
const stylesheet = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

describe("the fold animation", () => {
  it.each(["open", "close"])("fold-%s lasts exactly FOLD_MS", (direction) => {
    const rule = stylesheet.match(
      new RegExp(`\\.animate-fold-${direction}\\s*\\{[^}]*animation:\\s*fold-${direction}\\s+(\\d+)ms`),
    );
    expect(rule, `.animate-fold-${direction} has no animation`).not.toBeNull();
    expect(Number(rule![1])).toBe(FOLD_MS);
  });
});

/**
 * A fold turned back half way is started part way into the other direction (`useFold`),
 * which lands at the height it had reached only if both directions share one easing and
 * that easing is symmetric — the curve turned end for end is itself. The pantry's rows
 * and preview line fold against each other on the same assumption.
 */
describe("the fold easing", () => {
  const easing = (direction: string) =>
    stylesheet.match(new RegExp(`\\.animate-fold-${direction}\\s*\\{[^}]*animation:[^;]*?(cubic-bezier\\([^)]*\\))`))?.[1];

  it("is the same in both directions, and the same the chevron turns with", () => {
    const fold = easing("open");
    expect(fold).toBeDefined();
    expect(easing("close")).toBe(fold);
    expect(stylesheet).toContain(`--fold-ease: ${fold};`);
    expect(stylesheet).toContain(`--fold-ms: ${FOLD_MS}ms;`);
  });

  it("is symmetric", () => {
    const [x1, y1, x2, y2] = easing("open")!.slice("cubic-bezier(".length, -1).split(",").map(Number);
    expect(x1 + x2).toBeCloseTo(1);
    expect(y1 + y2).toBeCloseTo(1);
  });
});
