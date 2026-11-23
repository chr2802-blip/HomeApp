// Renders every raster icon from the two SVGs in public/: the maskable PNGs Android installs
// from, the notification badge (the mark alone, white on transparent — Android reads only its
// alpha) and src/app/favicon.ico (PNGs packed into an ICO). There is no PIL or ImageMagick in
// the container, so the browser draws them. Run after changing public/icon.svg or
// public/icon-maskable.svg: `node scripts/render-icons.mjs`.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const pub = (file) => path.join(root, "public", file);
const icon = readFileSync(pub("icon.svg"), "utf8");
const maskable = readFileSync(pub("icon-maskable.svg"), "utf8");
const badge = icon.replace(/<rect[^>]*\/>/, "").replace(/#[0-9a-f]{6}/gi, "#ffffff");

const browser = await chromium.launch();
const page = await browser.newPage();
async function draw(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${sized}</body></html>`);
  return page.screenshot({ omitBackground: true });
}

writeFileSync(pub("icon-maskable-192.png"), await draw(maskable, 192));
writeFileSync(pub("icon-maskable-512.png"), await draw(maskable, 512));
writeFileSync(pub("badge.png"), await draw(badge, 96));

const sizes = [16, 32, 48];
const pngs = [];
for (const size of sizes) pngs.push(await draw(icon, size));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((size, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngs[i].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return entry;
});
writeFileSync(path.join(root, "src/app/favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
await browser.close();
console.log("render-icons: wrote 2 maskable PNGs, badge.png and favicon.ico");
