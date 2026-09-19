import { ACCOUNTS, expect, test } from "./helpers/fixtures";
import { HOME_NAME, OTHER_HOME_NAME, prisma } from "./helpers/database";
import { pngBytes } from "../tests/helpers/images";
import type { Locator } from "@playwright/test";

/**
 * The storage donuts, through the browser.
 *
 * What only a browser can answer here is whether the rings are drawn at all. Each slice
 * takes its colour from a custom property — the kind's own on Settings, and on the
 * System page the household's, read off a `data-theme` on the slice itself the way a
 * home's dot reads it in the header's menu. A property that resolved to nothing leaves
 * the slice with no stroke, which in the markup is indistinguishable from one that came
 * out right: the numbers beside it are correct, the legend is complete, and the ring is
 * simply missing a piece. So the assertions below are about the computed colour rather
 * than about the element being there.
 *
 * What the figures themselves mean is pinned down in tests/integration/storage.test.ts,
 * against a real database, where it belongs.
 */

const NOTHING = ["none", "rgba(0, 0, 0, 0)", "transparent", ""];

/** The colour each slice actually came out, as the browser worked it out. */
function strokes(section: Locator) {
  return section.locator("[data-slice]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      key: node.getAttribute("data-slice"),
      stroke: getComputedStyle(node).stroke,
    })),
  );
}

/** A recipe with a picture on it, which is what makes a home big enough to chart. */
async function photographedRecipe(homeName: string) {
  const db = prisma();
  const home = await db.home.findFirstOrThrow({ where: { name: homeName } });
  const author = await db.user.findFirstOrThrow({
    where: { memberships: { some: { homeId: home.id } } },
  });
  const category =
    (await db.recipeCategory.findFirst({ where: { homeId: home.id } })) ??
    (await db.recipeCategory.create({ data: { homeId: home.id, name: "Weeknight" } }));

  const photo = await db.photo.create({
    data: {
      homeId: home.id,
      contentType: "image/png",
      width: 600,
      height: 600,
      bytes: pngBytes(600, 600, { noisy: true }),
      thumbWidth: 60,
      thumbHeight: 60,
      thumbBytes: pngBytes(60, 60, { noisy: true }),
    },
  });

  await db.recipe.create({
    data: {
      homeId: home.id,
      title: "Lasagne",
      createdById: author.id,
      photoId: photo.id,
      ingredients: "Pasta\nMince",
      instructions: "Layer and bake.",
      categories: { create: { categoryId: category.id } },
    },
  });

  return home;
}

test.describe("a home's own storage", () => {
  test("draws a ring whose slices came out in a colour", async ({ page, loginAs }) => {
    await photographedRecipe(HOME_NAME);
    await loginAs(ACCOUNTS.admin);
    await page.goto("/settings");

    const section = page.locator("section", {
      has: page.getByRole("heading", { name: "Storage" }),
    });
    await expect(section).toBeVisible();

    // The legend names every kind, including the ones this home has nothing of: a row
    // that vanishes at zero reads as a kind that is not counted rather than as one that
    // is empty.
    for (const kind of ["Recipes", "Lists", "Tasks", "Everything else"]) {
      await expect(section.getByText(kind, { exact: true })).toBeVisible();
    }

    const drawn = await strokes(section);
    expect(drawn.length).toBeGreaterThan(0);
    for (const slice of drawn) expect(NOTHING).not.toContain(slice.stroke);

    // The picture is nearly the whole of this home, so the ring is nearly all recipes.
    expect(drawn.map((slice) => slice.key)).toContain("recipes");
    await expect(
      section.locator("li").filter({ hasText: "Recipes" }).getByText(/^\d+(\.\d)? kB$/),
    ).toBeVisible();

    // And the number in the hole is a size rather than a placeholder. The kinds this
    // home has none of read "0 B" in the legend, which is the point of them being
    // listed; the total never does.
    await expect(section.locator("[data-donut-total]")).toHaveText(/^\d+(\.\d)? (kB|MB)$/);
  });
});

test.describe("the installation's storage", () => {
  test("gives each household its own colour, and each kind its own", async ({ page, loginAs }) => {
    const db = prisma();
    await photographedRecipe(HOME_NAME);
    await photographedRecipe(OTHER_HOME_NAME);
    await db.home.updateMany({ where: { name: HOME_NAME }, data: { theme: "OCEAN" } });
    await db.home.updateMany({ where: { name: OTHER_HOME_NAME }, data: { theme: "PLUM" } });

    await loginAs(ACCOUNTS.superAdmin);
    await page.goto("/admin/system");

    const section = page.locator("section", {
      has: page.getByRole("heading", { name: "Storage" }),
    });
    await expect(section.getByText(HOME_NAME, { exact: true })).toBeVisible();
    await expect(section.getByText(OTHER_HOME_NAME, { exact: true })).toBeVisible();

    const drawn = await strokes(section);
    for (const slice of drawn) expect(NOTHING).not.toContain(slice.stroke);

    // Two rings: one slice per home, one per kind. Both charts are on the page at once,
    // so this is also that the second did not quietly replace the first.
    expect(drawn.map((slice) => slice.key)).toEqual(
      expect.arrayContaining(["recipes", "rest"]),
    );

    // A home wears its own colour here, the same way its dot does in the header's menu —
    // which is only true if `var(--accent)` was read against the slice's own data-theme
    // rather than against the theme the page is in.
    const homeSlices = drawn.filter(
      (slice) => !["recipes", "lists", "tasks", "rest"].includes(slice.key ?? ""),
    );
    expect(homeSlices.length).toBe(2);
    expect(homeSlices[0]!.stroke).not.toBe(homeSlices[1]!.stroke);
  });
});
