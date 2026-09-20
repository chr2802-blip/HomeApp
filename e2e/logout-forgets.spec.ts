import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, prisma } from "./helpers/database";
import { pngBytes } from "../tests/helpers/images";

/**
 * What logging out takes with it.
 *
 * The service worker keeps two caches: the pages a household opens while out, and the
 * assets they are drawn with. The second of those holds `/api/photos/` alongside the
 * hashed chunks — so it holds the household's photographs, and it is served
 * cache-first, which means the server's own check on who may see a picture is never
 * asked again once a copy is kept.
 *
 * For a while only the page cache was dropped on the way out, and the pictures outlived
 * the session that fetched them with nothing to expire them. Nothing looked wrong: the
 * pages were gone, which is what anybody would check. This asks the browser what is
 * actually left in Cache Storage, because that is the only place the answer lives.
 */

const photoEntries = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    const names = await caches.keys();
    const assets = names.find((name) => name.startsWith("homehub-assets-"));
    if (!assets) return { assets: null as string | null, photos: [] as string[], chunks: 0 };

    const cache = await caches.open(assets);
    const kept = (await cache.keys()).map((request) => new URL(request.url).pathname);
    return {
      assets,
      photos: kept.filter((path) => path.startsWith("/api/photos/")),
      chunks: kept.filter((path) => path.startsWith("/_next/static/")).length,
    };
  });

test("logging out takes the household's pictures out of this browser", async ({
  page,
  loginAs,
}) => {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: HOME_NAME } });
  const owner = await db.user.findFirstOrThrow({ where: { email: ACCOUNTS.member.email } });

  // A picture on a list, which is a page the worker keeps — so opening it is what puts
  // the bytes in the cache, exactly as a household reading their shopping would.
  const bytes = Buffer.from(pngBytes(400, 300));
  const thumb = Buffer.from(pngBytes(200, 150));
  const photo = await db.photo.create({
    data: {
      homeId: home.id,
      contentType: "image/png",
      width: 400,
      height: 300,
      bytes,
      thumbWidth: 200,
      thumbHeight: 150,
      thumbBytes: thumb,
    },
    select: { id: true },
  });
  const list = await db.list.create({
    data: { homeId: home.id, createdById: owner.id, title: "Shopping", photoId: photo.id },
  });

  await loginAs(ACCOUNTS.member);

  // The worker is registered by the first load and takes over from the next one, and
  // only the loads it is in charge of are kept.
  await page.goto(`/lists/${list.id}`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  // The picture is drawn, so it has been asked for and kept.
  await expect.poll(async () => (await photoEntries(page)).photos.length).toBeGreaterThan(0);
  const before = await photoEntries(page);
  expect(before.photos.some((path) => path.includes(photo.id))).toBe(true);

  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login/);

  // The pictures go. The chunks stay: they are nobody's household, and dropping them
  // would make the next person wait for the app to download itself again.
  await expect.poll(async () => (await photoEntries(page)).photos).toEqual([]);
  expect((await photoEntries(page)).chunks).toBeGreaterThan(0);

  const pages = await page.evaluate(() =>
    caches.keys().then((names) => names.filter((name) => name.startsWith("homehub-pages-"))),
  );
  expect(pages).toEqual([]);
});
