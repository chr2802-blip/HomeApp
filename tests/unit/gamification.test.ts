import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The colours and the movement a list's feedback is made of, held to the stylesheet.
 *
 * The same failure as a theme with no block and a chart kind with no colour, in a third
 * place: `var(--chart-nothing)` resolves to nothing, so a progress bar drawn in it is a
 * track with an invisible fill — a bar that reads as 0% on a list that is nearly done,
 * which is worse than one that is obviously missing. And a class naming a keyframe
 * nobody wrote is an element that simply appears, which is exactly what the row's tick
 * did before it had an animation at all.
 *
 * None of this has a DOM signal either: the markup is identical whether the colour
 * resolves or the animation runs. `e2e/animation.spec.ts` asks the browser what actually
 * played; this asks, without a browser, whether there was anything to play.
 */
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const stylesheet = read("src/app/globals.css");

/**
 * A file with its prose taken out.
 *
 * Every question below is about what the file *draws*, and these files explain
 * themselves at length — the note saying why the bar is not green is not the bar being
 * green. Reading the comments as though they were code turns writing that reasoning
 * down into a failing test, which is the surest way to stop anybody writing it down.
 */
function code(file: string) {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/** Every `var(--x)` a file asks for, so the stylesheet can be asked whether it has one. */
function variablesIn(file: string) {
  return [...code(file).matchAll(/var\((--[a-z-]+)[,)]/g)].map((match) => match[1]);
}

/** Every `animate-x` class a file wears, as the keyframes name it. */
function animationsIn(file: string) {
  return [...code(file).matchAll(/animate-([a-z-]+)/g)].map((match) => match[1]);
}

/** What draws in a colour of its own, and so can ask for one that is not there. */
const PAINTED = ["src/components/progress-bar.tsx", "src/components/celebration.tsx"];

/** What wears an `animate-` class, and so can name keyframes nobody wrote. */
const MOVING = [
  ...PAINTED,
  "src/components/list-items.tsx",
  "src/components/task-done-button.tsx",
];

describe("the feedback a list gives back", () => {
  it.each(PAINTED)("draws %s in colours the stylesheet defines", (file) => {
    const wanted = variablesIn(file);
    expect(wanted.length).toBeGreaterThan(0);
    for (const variable of wanted) {
      expect(stylesheet, `${file} reads ${variable}, which globals.css does not define`).toMatch(
        new RegExp(`${variable}:\\s*[^;]+;`),
      );
    }
  });

  it.each(MOVING)("plays only movement %s the stylesheet has keyframes for", (file) => {
    for (const name of animationsIn(file)) {
      expect(stylesheet, `${file} plays ${name}, which globals.css has no keyframes for`).toMatch(
        new RegExp(`@keyframes ${name}\\b`),
      );
      expect(stylesheet).toMatch(new RegExp(`\\.animate-${name}\\b`));
    }
  });

  it("draws a list's own progress in the home's colour", () => {
    // The bar used to be a fixed blue on the reasoning that the accent dresses
    // controls and a bar is read rather than pressed. Drawn into the card's own bottom
    // edge there is nothing left for it to be mistaken for, and a household's progress
    // through its own lists is the household's. The assertion is here rather than
    // nowhere because the colour is the point: a hard-coded hex would look identical
    // in every screenshot of the one home that happened to match.
    expect(code("src/components/progress-bar.tsx")).toContain("var(--accent)");
  });

  it("keeps the three colours that already mean something out of both", () => {
    // Green is "added", red "about to be deleted", amber "overdue". A bar that turned
    // green on its last item, or confetti in those three, would be saying one of those
    // about a list that is merely finished.
    for (const file of PAINTED) {
      const source = code(file);
      for (const reserved of ["#059669", "#dc2626", "#d97706", "emerald", "red-", "amber"]) {
        expect(source, `${file} uses ${reserved}, which means something else`).not.toContain(
          reserved,
        );
      }
    }
  });
});
