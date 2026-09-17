import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_BAND, DEFAULT_THEME, THEMES, THEME_LABELS } from "@/lib/theme";

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
   * The band: one colour, in all four places that paint the top and bottom of the
   * screen. The header and the tab bar wear `--band`; so does the document behind them,
   * which is what an installed app on iOS paints its status bar from; `APP_BAND` repeats
   * it for `<meta name="theme-color">`, which is what a browser tints its chrome with;
   * and the manifest repeats it again for Android, where a WebAPK's status bar and
   * gesture bar are painted from `theme_color` at install and the meta tag is ignored.
   *
   * Opaque, and that is load-bearing rather than a matter of taste. A frosted band is a
   * different colour every time something else scrolls under it, and a strip the phone
   * paints can follow none of that: near enough still reads as two bars meeting. So the
   * alpha is checked as strictly as the hex.
   */
  it("paints the band as one flat colour every painter of it can carry", () => {
    const band = stylesheet.match(/--band:\s*([^;]+);/)?.[1].trim();

    expect(band, "no --band in globals.css").toMatch(/^#[0-9a-f]{6}$/);
    expect(APP_BAND).toBe(band);

    const manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), "public/manifest.webmanifest"), "utf8"),
    );
    expect(manifest.theme_color).toBe(band);
  });

  /**
   * The canvas is what an installed app on iOS paints the strip holding the clock and
   * the battery with, so a document that does not carry the band leaves that strip the
   * colour of the page — the seam the band exists to close, and invisible in a browser.
   */
  it("gives the document itself the band, not just the header", () => {
    expect(stylesheet).toMatch(/html\s*\{[^}]*background-color:\s*var\(--band\)/);
  });

  /**
   * And no theme may take the band back. A `--accent-soft` in one block would dress that
   * household's header in a colour the phone's own bars cannot be told about, which is
   * exactly the arrangement this replaced.
   */
  it.each(THEMES)("leaves the band alone in %s", (theme) => {
    expect(blockFor(theme)).not.toContain("--band:");
    expect(blockFor(theme)).not.toContain("--accent-soft:");
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
