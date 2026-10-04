import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MENU_EXIT_MS, SHEET_EXIT_MS, SNACK_EXIT_MS } from "@/lib/motion";

/**
 * How the app moves is written once, as tokens at the top of globals.css, and a few
 * timers in JS wait for an animation to finish before unmounting what played it. Those
 * timers cannot read a CSS variable, so each is held to its token here: shorter, and the
 * exit is cut off half way; longer, and something invisible sits over the page.
 */
const stylesheet = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string) {
  const match = stylesheet.match(new RegExp(`--${name}:\\s*(\\d+)ms;`));
  expect(match, `--${name} is not defined in globals.css`).not.toBeNull();
  return Number(match![1]);
}

describe("timers that wait for an exit", () => {
  it("a sheet is unmounted when its exit has played", () => {
    expect(token("dur-sheet-out")).toBe(SHEET_EXIT_MS);
  });

  it("the three-dot menu is unmounted when its exit has played", () => {
    expect(token("dur-menu-out")).toBe(MENU_EXIT_MS);
  });

  it("a snack is taken away when its exit has played", () => {
    expect(token("dur-row")).toBe(SNACK_EXIT_MS);
  });
});

/**
 * A curve written out in a rule rather than read from a token is how the app came to have
 * six of them. The fold keeps its own literal (`fold.test.ts` holds it, and it has to be
 * symmetric), and confetti falls rather than arrives.
 */
describe("easing curves", () => {
  it("are written only as tokens, the fold and the confetti", () => {
    const literals = [...stylesheet.matchAll(/^.*cubic-bezier\([^)]*\).*$/gm)].map((m) => m[0].trim());
    const allowed = literals.filter(
      (line) => /^--ease-[a-z]+:/.test(line) || /^--fold-ease:/.test(line) || /fold-(open|close)/.test(line),
    );
    const rest = literals.filter((line) => !allowed.includes(line));
    expect(rest).toEqual(["animation-timing-function: cubic-bezier(0.25, 0.6, 0.55, 1);"]);
  });
});

/**
 * A press is one of three tiers (`press-icon`, `press-button`, `press-card`), chosen by
 * size. An `active:scale-*` written beside one is a fourth opinion about how far a thing
 * goes in, which is how there came to be six; and the tiers live in `@layer components`
 * so a utility can still win, which the old unlayered `.pressable` never let one.
 */
describe("press feedback", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".tsx")) files.push(full);
    }
  };
  walk(path.join(process.cwd(), "src"));

  it("is never an active:scale written by hand", () => {
    const offenders = files.filter((file) => /active:scale-/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("defines each tier, inside the components layer", () => {
    const layer = stylesheet.slice(stylesheet.indexOf("@layer components"));
    for (const tier of ["press-icon", "press-button", "press-card"]) {
      expect(layer, tier).toMatch(new RegExp(`\\.${tier}:active[^{]*\\{[^}]*scale:`));
    }
    expect(stylesheet).not.toMatch(/^\.pressable\b/m);
  });
});
