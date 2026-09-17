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
  "--accent-bar",
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
   * What the header actually renders as, which three separate things have to agree on:
   * the header itself (`--accent-soft`, translucent so it can blur what scrolls under
   * it), the canvas behind the page (`--accent-bar`, which is what an installed app
   * paints its status bar from) and `THEME_BAR` (which is what a browser tints its
   * chrome with, and cannot be a variable because a meta tag takes a literal).
   *
   * So the arithmetic is done here rather than trusted anywhere: the soft colour over
   * the page is what somebody looking at the top of the screen sees, and both of the
   * opaque copies have to be exactly that. They disagree silently — the strip simply
   * stops being the colour of the header a millimetre below it.
   */
  it.each(THEMES)("paints %s's band, the page behind it and the bar alike", (theme) => {
    const soft = blockFor(theme)?.match(/--accent-soft:\s*rgb\(([^)]*)\)/)?.[1];
    expect(soft, `no --accent-soft for ${theme}`).toBeTruthy();

    const [channels, alpha] = soft!.split("/");
    const over = channels.trim().split(/\s+/).map(Number);
    const opacity = Number(alpha);

    const page = stylesheet.match(/--page:\s*#([0-9a-f]{6})/)?.[1];
    expect(page, "no --page in globals.css").toBeTruthy();
    const behind = [0, 2, 4].map((at) => parseInt(page!.slice(at, at + 2), 16));

    // What the browser composites: the header's colour at its own opacity, over the
    // page it is drawn on top of.
    const rendered = `#${over
      .map((channel, index) => Math.round(opacity * channel + (1 - opacity) * behind[index]!))
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;

    expect(blockFor(theme)).toContain(`--accent-bar: ${rendered};`);
    expect(THEME_BAR[theme]).toBe(rendered);
  });

  /**
   * The canvas is what a home screen app paints the strip holding the clock and the
   * battery with, so a document that does not carry the band leaves that strip the
   * colour of the page — which is the seam the band exists to close.
   */
  it("gives the document itself the band, not just the header", () => {
    expect(stylesheet).toMatch(/html\s*\{[^}]*background-color:\s*var\(--accent-bar\)/);
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
