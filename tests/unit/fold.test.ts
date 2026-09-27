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
