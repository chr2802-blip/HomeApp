import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND, DEFAULT_THEME, THEMES, THEME_LABELS } from "@/lib/theme";

/**
 * A home's colour is named in TypeScript and drawn in CSS, and nothing but this holds
 * the two together.
 *
 * A theme added to the schema without a block in the stylesheet does not fail to build
 * and does not look broken: the variables simply stay whatever the document already had,
 * so the home wears the colours of whichever one was open before it. That is the exact
 * bug the colours exist to prevent, and it is invisible unless something reads the
 * stylesheet — which is what this does.
 */
const stylesheet = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

/** Every variable a theme has to define; anything that wears the colour reads these. */
const VARIABLES = [
  "--band",
  "--accent",
  "--accent-hover",
  "--accent-text",
  "--accent-line",
];

/** The declarations inside `[data-theme="NAME"] { … }`, or null when there is no block. */
function blockFor(theme: string): string | null {
  const match = stylesheet.match(
    new RegExp(`\\[data-theme="${theme}"\\][^{]*\\{([^}]*)\\}`),
  );
  return match?.[1] ?? null;
}

describe("home themes", () => {
  it("offers every theme the schema has, each with a name", () => {
    // THEME_LABELS is typed as a Record over the enum, so a theme with no name here
    // fails to compile; this is only that the list read off it is not empty.
    expect(THEMES.length).toBeGreaterThan(1);
    for (const theme of THEMES) expect(THEME_LABELS[theme]).toBeTruthy();
  });

  it.each(THEMES)("draws %s in the stylesheet", (theme) => {
    const block = blockFor(theme);
    expect(block, `no [data-theme="${theme}"] block in globals.css`).not.toBeNull();
    for (const variable of VARIABLES) expect(block).toContain(`${variable}:`);
  });

  it("dresses everything outside a home in the default theme", () => {
    // :root carries the same values as the default, so the login page, an invite and a
    // person between homes are not left with no colours at all.
    const root = stylesheet.match(/:root,\s*\[data-theme="(\w+)"\]/);
    expect(root?.[1]).toBe(DEFAULT_THEME);
  });

  /**
   * The band, and the four painters of the screen's edges that have to agree about it.
   *
   * It is the same literal in every theme block now — a browser does not retint an
   * installed app's status bar as somebody moves between homes, so a band that varied by
   * theme showed up as a seam between whichever colour was there first and the header
   * underneath it. The header, the tab bar and the document behind them read `--band`
   * straight out of the stylesheet, so the only one that can drift from the rest is the
   * copy in TypeScript — which is the one the phone's status bar is tinted from, and the
   * one nothing on a desktop ever shows.
   *
   * Opaque, in every theme, and that is load-bearing rather than a matter of taste. A
   * frosted band is a different colour every time something scrolls under it, and a
   * strip the phone paints can follow none of that: near enough still reads as two bars
   * meeting. So the alpha is checked as strictly as the hex.
   */
  it.each(THEMES)("gives %s the one band, the stylesheet and the meta tag both carry", (theme) => {
    const band = blockFor(theme)?.match(/--band:\s*([^;]+);/)?.[1].trim();

    expect(band, `no --band in [data-theme="${theme}"]`).toMatch(/^#[0-9a-f]{6}$/);
    expect(band).not.toBe("#ffffff");
    expect(BAND).toBe(band);
  });

  /**
   * The manifest is the painter that cannot follow anybody: an installed app reads
   * `theme_color` once, when it is installed, and shows it on the splash screen before
   * the app has said a word. Now that the band is one colour it carries exactly that,
   * same as everything else.
   */
  it("gives the manifest the one band", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), "public/manifest.webmanifest"), "utf8"),
    );

    expect(manifest.theme_color).toBe(BAND);
  });

  /**
   * The canvas is what an installed app on iOS paints the strip holding the clock and
   * the battery with — iOS reads no meta tag for it — so a document that does not carry
   * the band leaves that strip the colour of the page. That is the seam the band exists
   * to close, and it is invisible in a browser.
   */
  it("gives the document itself the band, not just the header", () => {
    expect(stylesheet).toMatch(/html\s*\{[^}]*background-color:\s*var\(--band\)/);
  });

  /**
   * And the band is the only thing a household is allowed to repaint the frame with. An
   * `--accent-soft` beside it would be a second colour for the same strip, and the one
   * the phone is told about is whichever of the two the header did not use.
   */
  it.each(THEMES)("keeps %s to the one colour for the frame", (theme) => {
    expect(blockFor(theme)).not.toContain("--accent-soft:");
  });

  /**
   * The bottom of the screen is the app's own, and three files have to agree for it.
   *
   * The viewport is laid out under the phone's bars, the tab bar pads itself past the
   * gesture bar and paints the band behind it, and what scrolls clears both. Drop the
   * viewport line and the insets are zero everywhere — the layout still looks right, and
   * the strip at the bottom goes back to being a colour the manifest chose at install.
   * Drop either padding and the insets are not zero and nothing accounts for them, which
   * puts the tabs under the gesture bar. Neither shows up in a desktop browser, where
   * every inset is zero either way.
   */
  it("lays the app out under the phone's bars, and pads for them", () => {
    const read = (file: string) =>
      readFileSync(path.join(process.cwd(), file), "utf8");

    expect(read("src/app/layout.tsx")).toMatch(/viewportFit:\s*"cover"/);

    // The tab bar leaves the gesture bar its room, and its background — the band —
    // is what fills it.
    const nav = read("src/components/bottom-nav.tsx");
    expect(nav).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(nav).toContain("bg-[var(--band)]");

    // And the frame around the page accounts for both ends.
    const app = read("src/app/(app)/layout.tsx");
    expect(app).toContain("pt-[env(safe-area-inset-top)]");
    expect(app).toContain("pb-[calc(7rem+env(safe-area-inset-bottom))]");
  });

  /*
   * Action mode is the one surface that escapes that frame — it is fixed over the whole
   * viewport, portalled past the header and the tab bar — so nothing else is padding for
   * the phone's bars on its behalf. Held here beside the frame's own insets because the
   * failure is identical: invisible in a browser, obvious on a phone, and only ever seen
   * by somebody holding one.
   */
  it("pads action mode for the phone's bars itself, since nothing else will", () => {
    const cook = readFileSync(path.join(process.cwd(), "src/components/cook-mode.tsx"), "utf8");

    expect(cook).toContain("pt-[env(safe-area-inset-top)]");
    expect(cook).toContain("pb-[max(0.75rem,env(safe-area-inset-bottom))]");
    expect(cook).toContain("env(safe-area-inset-left)");
    expect(cook).toContain("env(safe-area-inset-right)");
  });

  /*
   * The page turn is a keyframe animation and not a transition, because there is no paint
   * between a page being mounted and its arrival. A transition written here would look
   * entirely correct and run nothing — which is also why `e2e/cook-mode.spec.ts` asserts
   * that the animation actually fired rather than that the class is present.
   */
  it("turns action mode's pages with keyframes, in both directions", () => {
    for (const name of ["page-turn-next", "page-turn-back"]) {
      expect(stylesheet).toContain(`@keyframes ${name}`);
      expect(stylesheet).toContain(`.animate-${name}`);
    }

    // A leaf swings about its spine: forward from the left edge, back from the right.
    expect(stylesheet).toMatch(/\.animate-page-turn-next\s*\{[^}]*transform-origin:\s*left center/);
    expect(stylesheet).toMatch(/\.animate-page-turn-back\s*\{[^}]*transform-origin:\s*right center/);
  });

  it("keeps the colours that already mean something out of the palette", () => {
    // Green is "added", red "about to be deleted", amber "overdue". A home dressed in
    // one of them would be saying it on every screen, so its --accent is checked
    // against the hues those three are drawn in.
    const reserved = [
      "#059669", // emerald-600, the create button
      "#dc2626", // red-600, the destructive one
      "#d97706", // amber-600, overdue
    ];
    for (const theme of THEMES) {
      const accent = blockFor(theme)?.match(/--accent:\s*([^;]+);/)?.[1].trim();
      expect(reserved).not.toContain(accent);
    }
  });
});
