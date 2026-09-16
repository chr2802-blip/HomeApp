import { ACCOUNTS, expect, openHomeMenu, test } from "./helpers/fixtures";
import { prisma } from "./helpers/database";
import { pngBytes } from "../tests/helpers/images";

/** A picture the size a phone takes them; it is shrunk in the browser before it is sent. */
const picture = () => ({
  name: "me.png",
  mimeType: "image/png",
  buffer: pngBytes(3000, 2000),
});

test.describe("your profile", () => {
  test("is reached from the home's name in the header, by anybody", async ({ page, loginAs }) => {
    // A plain member runs no home, so the same menu offers them this and not Settings.
    await loginAs(ACCOUNTS.member);
    await page.goto("/dashboard");

    await openHomeMenu(page);
    await expect(page.getByRole("menuitem", { name: "Settings" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Profile" }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(ACCOUNTS.member.name);
  });

  test("changes the name every home sees", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/profile");

    await page.getByLabel("Name", { exact: true }).fill("Ada Renamed");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByText("Ada Renamed (you)")).toBeVisible();
  });

  test("keeps a picture, and shows it beside them on the members list", async ({
    page,
    loginAs,
  }) => {
    await loginAs(ACCOUNTS.admin);
    await page.goto("/profile");

    await page.getByLabel("Your picture").setInputFiles(picture());
    // The preview appears only once the upload has been answered with an id, so it is
    // the one signal that the round trip is done.
    await expect(page.getByAltText("The picture you chose")).toBeVisible();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const stored = await prisma().user.findFirstOrThrow({ where: { email: ACCOUNTS.admin.email } });
    expect(stored.photoId).not.toBeNull();

    // Decorative beside their name, so it is found by where it sits rather than by alt.
    await page.goto("/settings");
    await expect(page.locator("main img")).toHaveCount(1);
  });

  test("offers the way to your other homes in the same menu", async ({ page, loginAs }) => {
    await loginAs(ACCOUNTS.member);
    await page.goto("/dashboard");

    await openHomeMenu(page);
    await page.getByRole("menuitem", { name: "All your homes" }).click();

    await expect(page).toHaveURL(/\/homes$/);
  });
});
