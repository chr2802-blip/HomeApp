import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEMES, THEME_BAR, THEME_LABELS } from "@/lib/theme";

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
  "--accent",
  "--accent-hover",
  "--accent-text",
  "--accent-soft",
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
   * The one colour the top of the screen is, in all three places that paint it: the
   * header and the tab bar (`--accent-soft`), the document behind them — which is what
   * an installed app paints the strip holding the clock and the battery with — and
   * `THEME_BAR`, which is what a browser tints its own chrome with and cannot be a
   * variable because a meta tag takes a literal.
   *
   * Opaque, and that is the load-bearing part rather than a detail of taste. A frosted
   * band is a different colour every time something else scrolls under it, and a strip
   * the phone paints can follow none of that: near enough still reads as two bars
   * meeting. So the alpha is checked as strictly as the hex.
   */
  it.each(THEMES)("paints %s's band as one flat colour the phone can copy", (theme) => {
    const band = blockFor(theme)?.match(/--accent-soft:\s*([^;]+);/)?.[1].trim();

    expect(band, `no --accent-soft for ${theme}`).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_BAR[theme]).toBe(band);
  });

  /**
   * The canvas is what a home screen app paints that strip with, so a document that does
   * not carry the band leaves the strip the colour of the page — which is the seam the
   * band exists to close, and it is invisible in a browser.
   */
  it("gives the document itself the band, not just the header", () => {
    expect(stylesheet).toMatch(/html\s*\{[^}]*background-color:\s*var\(--accent-soft\)/);
  });

  /**
   * The manifest's own colour cannot follow the household: it is read once, when the app
   * is installed, and the document's tag takes over the moment a page renders. So it has
   * to be the default theme's band — anything else is a flash of the wrong colour every
   * time the app is opened.
   */
  it("opens an installed app in the default theme's band", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), "public/manifest.webmanifest"), "utf8"),
    );

    expect(manifest.theme_color).toBe(THEME_BAR[DEFAULT_THEME]);
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
