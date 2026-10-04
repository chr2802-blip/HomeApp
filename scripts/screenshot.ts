/**
 * `npm run screenshot -- /dashboard /pantry` — a phone-sized picture of a page, as a
 * demo person, against the dev server that is already running.
 *
 * The other half of `npm run db:demo`. Every UI session used to copy `loginAs` into a
 * throwaway spec for this, then find Next's dev overlay sitting over the tab bar, then a
 * 0.6s animation already finished by the first frame. This does all three.
 *
 *   --home flat|da|empty   which demo home is on screen (default flat)
 *   --as alex|sam          who is looking (default alex, an admin)
 *   --width 390 --height 844   the viewport (default a phone's)
 *   --full                 the whole page rather than the first screen
 *   --slow 0.1             play every animation at this rate; take frames with --wait
 *   --wait 1500            ms to wait after the page settles, before the shot
 *   --out <dir>            where the PNGs go (default ./screenshots, git-ignored)
 *   --url http://localhost:3000
 *
 * It signs a session with the `.env`'s AUTH_SECRET the way `e2e/helpers/session.ts`
 * does, so nothing is typed into the login form. It switches the person's active home by
 * writing `activeHomeId` directly — a dev database's demo people, nobody else.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { DEMO_HOMES, DEMO_PEOPLE, type DemoHomeKey, type DemoPerson } from "./demo-cast";

// Mirrors `createSession` in src/lib/auth.ts, which writes through next/headers and so
// cannot be called from here.
const COOKIE = "homehub_session";
const MAX_AGE = 60 * 60 * 24 * 30;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      home: { type: "string", default: "flat" },
      as: { type: "string", default: "alex" },
      width: { type: "string", default: "390" },
      height: { type: "string", default: "844" },
      full: { type: "boolean", default: false },
      slow: { type: "string" },
      wait: { type: "string", default: "300" },
      out: { type: "string", default: "screenshots" },
      url: { type: "string", default: process.env.SCREENSHOT_URL ?? "http://localhost:3000" },
    },
  });

  const paths = positionals.length > 0 ? positionals : ["/dashboard"];
  if (!(values.home in DEMO_HOMES)) throw new Error(`--home is one of ${Object.keys(DEMO_HOMES).join(", ")}`);
  if (!(values.as in DEMO_PEOPLE)) throw new Error(`--as is one of ${Object.keys(DEMO_PEOPLE).join(", ")}`);
  const homeKey = values.home as DemoHomeKey;
  const personKey = values.as as DemoPerson;

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set — run `npm run setup`, which writes .env.");

  try {
    await fetch(values.url, { redirect: "manual" });
  } catch {
    throw new Error(`Nothing is answering at ${values.url}. Start it with \`npm run dev\` (in the background).`);
  }

  const prisma = new PrismaClient();
  let userId: string;
  try {
    const home = await prisma.home.findFirst({ where: { name: DEMO_HOMES[homeKey].name }, select: { id: true } });
    const user = await prisma.user.findUnique({
      where: { email: DEMO_PEOPLE[personKey].email },
      select: { id: true, tokenVersion: true },
    });
    if (!home || !user) throw new Error("The demo household is not there. Run `npm run db:demo` first.");
    await prisma.user.update({ where: { id: user.id }, data: { activeHomeId: home.id } });
    userId = user.id;

    const token = await new SignJWT({ sub: userId, ver: user.tokenVersion })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${MAX_AGE}s`)
      .sign(new TextEncoder().encode(secret));

    const width = Number(values.width);
    const height = Number(values.height);
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        isMobile: width < 640,
        hasTouch: width < 640,
      });
      await context.addCookies([
        { name: COOKIE, value: token, url: values.url, httpOnly: true, sameSite: "Lax", secure: values.url.startsWith("https:") },
      ]);
      const page = await context.newPage();

      if (values.slow) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Animation.enable");
        await cdp.send("Animation.setPlaybackRate", { playbackRate: Number(values.slow) });
      }

      const outDir = path.resolve(values.out);
      mkdirSync(outDir, { recursive: true });

      for (const target of paths) {
        await page.goto(new URL(target, values.url).toString(), { waitUntil: "networkidle" });
        if (new URL(page.url()).pathname === "/login") {
          throw new Error("Landed on /login: the dev server's AUTH_SECRET is not the one in .env.");
        }
        // Next's dev overlay ("1 Issue") sits over the tab bar in every phone shot.
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
        await page.waitForTimeout(Number(values.wait));

        const slug = target.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "") || "root";
        const file = path.join(outDir, `${slug}-${homeKey}-${width}.png`);
        await page.screenshot({ path: file, fullPage: values.full });
        console.log(file);
      }
    } finally {
      await browser.close();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
