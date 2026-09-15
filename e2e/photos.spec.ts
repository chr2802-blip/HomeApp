import { ACCOUNTS, expect, openDialog, test } from "./helpers/fixtures";
import { CATEGORIES, prisma } from "./helpers/database";
import { pngBytes } from "../tests/helpers/images";

/**
 * A picture the size a phone takes them. Nothing here asserts that this exact file
 * reaches the server — the point of the whole feature is that it does not.
 */
const ORIGINAL = { width: 3000, height: 2000 };

/** The longest edges anything is stored at; keep in step with lib/downscale.ts. */
const MAX_EDGE = 1600;
const THUMB_EDGE = 600;

/** The heaviest a stored picture may be; keep in step with lib/photo-file.ts. */
const MAX_PHOTO_BYTES = 1_200_000;

function original() {
  return {
    name: "holiday.png",
    mimeType: "image/png",
    buffer: pngBytes(ORIGINAL.width, ORIGINAL.height),
  };
}

/**
 * Picks a file and waits for it to have been shrunk and uploaded.
 *
 * The preview appears only once the server has answered with an id, so it is the one
 * signal that the whole round trip is done — a fixed wait would be a race, and the
 * markup before and after carries nothing else that differs.
 */
async function attachPicture(page: Parameters<typeof openDialog>[0], label = "Photo") {
  await page.getByLabel(label).setInputFiles(original());
  await expect(page.getByAltText("The picture you chose")).toBeVisible();
}

test("a phone-sized picture is shrunk in the browser and shown on the recipe", async ({
  page,
  loginAs,
}) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/recipes/new");

  await page.getByLabel("Title").fill("Pancakes");
  await page.getByLabel("Category").selectOption({ label: CATEGORIES[0] });
  await attachPicture(page, "Picture");
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page).toHaveURL(/\/recipes\/[a-z0-9]+$/);
  await expect(page.getByAltText("Pancakes")).toBeVisible();

  const recipe = await prisma().recipe.findFirstOrThrow();
  expect(recipe.photoId).not.toBeNull();

  /*
   * What was actually stored: three thousand pixels across went in, sixteen hundred
   * came out, at the same shape and re-encoded as a JPEG. That the dimensions changed
   * is the proof the browser did the work — nothing on the server resizes anything.
   *
   * Deliberately no comparison against the weight of the file that was picked. This one
   * is a synthetic gradient, which PNG compresses far better than it compresses a
   * photograph, so the arithmetic that holds for a real picture would not hold here and
   * the test would be measuring the fixture. What matters is that the result is inside
   * the limit the server enforces, whatever was picked.
   */
  const photo = await prisma().photo.findUniqueOrThrow({ where: { id: recipe.photoId! } });
  expect(photo.contentType).toBe("image/jpeg");
  expect(Math.max(photo.width, photo.height)).toBe(MAX_EDGE);
  expect(photo.width / photo.height).toBeCloseTo(ORIGINAL.width / ORIGINAL.height, 2);
  expect(photo.bytes.length).toBeLessThan(MAX_PHOTO_BYTES);

  expect(Math.max(photo.thumbWidth, photo.thumbHeight)).toBe(THUMB_EDGE);
  expect(photo.thumbBytes.length).toBeLessThan(photo.bytes.length);
});

test("the picture is shown on the recipe's card in the directory", async ({ page, loginAs }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/recipes/new");

  await page.getByLabel("Title").fill("Pancakes");
  await page.getByLabel("Category").selectOption({ label: CATEGORIES[0] });
  await attachPicture(page, "Picture");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page).toHaveURL(/\/recipes\/[a-z0-9]+$/);

  await page.goto("/recipes");
  const recipe = await prisma().recipe.findFirstOrThrow();

  // The card asks for the thumbnail, not the full picture: twenty cards would
  // otherwise be twenty times the weight of the one page that shows a picture whole.
  const card = page.locator(`img[src="/api/photos/${recipe.photoId}?size=thumb"]`);
  await expect(card).toBeVisible();
});

test("a list keeps a picture, and taking it off removes it", async ({ page, loginAs }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/lists");

  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Shopping");
  await attachPicture(page);
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/\/lists\/[a-z0-9]+$/);

  const list = await prisma().list.findFirstOrThrow();
  expect(list.photoId).not.toBeNull();
  const photoId = list.photoId!;

  await openDialog(page, "Edit");
  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  expect((await prisma().list.findFirstOrThrow()).photoId).toBeNull();
  // And the bytes go with it, rather than sitting in the database forever.
  expect(await prisma().photo.findUnique({ where: { id: photoId } })).toBeNull();
});

test("the home's own picture reaches the header and the dashboard", async ({ page, loginAs }) => {
  await loginAs(ACCOUNTS.admin);
  await page.goto("/admin");

  await page.getByLabel("Home picture").setInputFiles(original());
  await expect(page.getByAltText("The picture you chose")).toBeVisible();
  await page.getByRole("button", { name: "Save home" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByAltText("E2E House")).toHaveCount(2); // header and banner
});

test("a picture is not served to another household", async ({ page, loginAs }) => {
  await loginAs(ACCOUNTS.member);
  await page.goto("/lists");

  await openDialog(page, "New list");
  await page.getByLabel("List name").fill("Shopping");
  await attachPicture(page);
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/\/lists\/[a-z0-9]+$/);

  const photoId = (await prisma().list.findFirstOrThrow()).photoId!;

  /*
   * Asked for from inside the page, which is how the browser asks for it: the session
   * is a cookie, and the question is what that session may see.
   *
   * `no-store` because a stored picture is served as immutable — its URL can never
   * answer anything else, since replacing a picture makes a new row with a new id — so
   * the browser is entitled to answer the second request out of its own cache without
   * asking the server at all. That is the right behaviour and the reason the pages are
   * cheap; it just means a test about what the server will serve has to ask the server.
   */
  const status = (id: string) =>
    page.evaluate(
      async (photo) => (await fetch(`/api/photos/${photo}`, { cache: "no-store" })).status,
      id,
    );

  expect(await status(photoId)).toBe(200);

  // Not 403: an id from another home answers exactly as an id that never existed,
  // which is the only answer that tells an outsider nothing.
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login/);
  await loginAs(ACCOUNTS.outsider);
  expect(await status(photoId)).toBe(404);
});
