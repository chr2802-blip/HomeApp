import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STORAGE_KINDS, formatBytes, formatShare } from "@/lib/storage";
import { STORAGE_KIND_LABELS } from "@/lib/copy/settings";

const stylesheet = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

describe("formatBytes", () => {
  it("counts in thousands, the way every other app reports a picture's size", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1000)).toBe("1.0 kB");
    expect(formatBytes(1_500_000)).toBe("1.5 MB");
    expect(formatBytes(2_400_000_000)).toBe("2.4 GB");
  });

  it("keeps one decimal only where it says something", () => {
    // Bytes are already exact, so "512.0 B" would be precision about nothing, and past
    // a hundred of anything the decimal is noise in a number read at a glance.
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(120_000)).toBe("120 kB");
    expect(formatBytes(9_900)).toBe("9.9 kB");
  });

  it("does not fall apart on a number that is not one", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("formatShare", () => {
  it("rounds, and never down to nothing while there is something there", () => {
    // A row reading "0%" beside a size in kilobytes reads as a broken number rather
    // than as a small one, which is the whole reason this is not a bare Math.round.
    expect(formatShare(50, 100)).toBe("50%");
    expect(formatShare(1, 1000)).toBe("<1%");
    expect(formatShare(0, 1000)).toBe("0%");
    expect(formatShare(10, 0)).toBe("0%");
  });
});

/**
 * The chart colours are named in TypeScript and drawn in CSS, and — exactly as with a
 * home's theme — nothing but this holds the two together.
 *
 * A kind added to `STORAGE_KINDS` without a `--chart-<kind>` in the stylesheet does not
 * fail to build and does not look broken: `var(--chart-whatever)` resolves to nothing,
 * the slice is drawn with no stroke, and the ring simply comes up short while the
 * legend beside it still lists the row. That is a chart quietly lying about a total,
 * which is worse than one that is obviously missing.
 */
describe("the chart palette", () => {
  it.each(STORAGE_KINDS)("draws %s in the stylesheet", (kind) => {
    expect(stylesheet, `no --chart-${kind} in globals.css`).toMatch(
      new RegExp(`--chart-${kind}:\\s*#[0-9a-f]{6};`),
    );
  });

  it("names every kind it draws, in both languages", () => {
    // STORAGE_KIND_LABELS is a Record over the kinds, so a missing one fails to
    // compile; this is only that neither language's name is an empty string.
    for (const kind of STORAGE_KINDS) {
      expect(STORAGE_KIND_LABELS[kind].EN).toBeTruthy();
      expect(STORAGE_KIND_LABELS[kind].DA).toBeTruthy();
    }
  });

  it("keeps the colours that already mean something out of it", () => {
    // The same three a home's theme may not be: green is "added", red "about to be
    // deleted", amber "overdue". A slice in one of them would be saying it about a
    // third of somebody's recipes.
    const reserved = ["#059669", "#dc2626", "#d97706"];
    for (const kind of STORAGE_KINDS) {
      const colour = stylesheet.match(new RegExp(`--chart-${kind}:\\s*([^;]+);`))?.[1].trim();
      expect(reserved).not.toContain(colour);
    }
  });

  it("does not let a slice wear a home's colour", () => {
    // The accent dresses controls, and these are not controls — but more to the point a
    // legend drawn in the household's own colour would mean one thing in the flat and
    // another in the summer house, while the kinds it names are the same in both.
    for (const kind of STORAGE_KINDS) {
      const colour = stylesheet.match(new RegExp(`--chart-${kind}:\\s*([^;]+);`))?.[1].trim();
      expect(colour).not.toContain("var(--accent");
    }
  });
});
