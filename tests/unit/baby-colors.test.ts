import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BABY_KINDS, BABY_SHADES } from "@/lib/baby-colors";

const stylesheet = readFileSync(path.resolve(__dirname, "../../src/app/globals.css"), "utf8");

/** The colours the app has given a meaning — added, about to be deleted, overdue. */
const MEANINGS = [/#(16a34a|22c55e|15803d)/i, /#(dc2626|ef4444|b91c1c)/i, /#(d97706|f59e0b|b45309)/i];

describe("the baby log's colours", () => {
  it("are all declared, as plain hex, for every kind and shade", () => {
    for (const kind of BABY_KINDS) {
      for (const shade of [...BABY_SHADES, ...(kind === "sleep" ? ["-nap"] : [])]) {
        const name = shade === "-nap" ? "--baby-nap" : `--baby-${kind}${shade}`;
        expect(stylesheet, `no ${name} in globals.css`).toMatch(new RegExp(`${name}:\\s*#[0-9a-f]{6};`));
      }
    }
  });

  it("are none of the colours that already mean something", () => {
    const block = stylesheet.slice(stylesheet.indexOf("--baby-sleep:"), stylesheet.indexOf("--baby-diaper-text:") + 40);
    for (const meaning of MEANINGS) expect(block).not.toMatch(meaning);
  });

  it("keep each kind's text readable on its own tile", () => {
    const hex = (name: string) => stylesheet.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6});`))![1]!;
    const luminance = (value: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(value.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const kind of BABY_KINDS) {
      const [a, b] = [luminance(hex(`--baby-${kind}-text`)), luminance(hex(`--baby-${kind}-soft`))];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      expect(ratio, `--baby-${kind}-text on its soft tile`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
