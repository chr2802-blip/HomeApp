import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Android draws an installed app's icon in a circle. Handed only an icon marked `any`, it
 * shrinks it and sets it on a white disc — a dark square in a white ring on the home
 * screen. A `maskable` icon is full-bleed with the mark inside the middle 80%, and is
 * cropped to the circle instead. Nothing on a desktop shows the difference.
 */
describe("the installed app's icon", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  const maskable = (manifest.icons as { src: string; sizes: string; purpose?: string }[]).filter(
    (icon) => icon.purpose?.split(" ").includes("maskable"),
  );

  it("offers Android a maskable icon, at the size it installs from", () => {
    expect(maskable.map((icon) => icon.sizes)).toContain("512x512");
    for (const icon of maskable) {
      expect(existsSync(path.join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
    }
  });

  it("fills the whole square, so the crop leaves no ring", () => {
    // The source the PNGs are rendered from: a background with no rounded corners.
    expect(read("public/icon-maskable.svg")).toMatch(/<rect width="192" height="192" fill="#000000"\/>/);
  });
});
