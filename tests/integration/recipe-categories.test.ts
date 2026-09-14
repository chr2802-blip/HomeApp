import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createRecipeCategory,
  deleteRecipeCategory,
  renameRecipeCategory,
} from "@/app/actions/recipe-categories";
import {
  createHome,
  createHomeWithMembers,
  createRecipe,
  createRecipeCategory as seedCategory,
  createUser,
  formData,
  signIn,
  submit,
} from "../helpers/factories";
import { expectRedirect } from "../helpers/expect";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let admin: Awaited<ReturnType<typeof createHomeWithMembers>>["admin"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, admin, member } = await createHomeWithMembers());
  await signIn(admin);
});

describe("createRecipeCategory", () => {
  it("adds a category to the admin's own home", async () => {
    expect(await submit(createRecipeCategory, { name: "Baking" })).toEqual({ ok: true });

    expect(await prisma.recipeCategory.findFirstOrThrow()).toMatchObject({
      name: "Baking",
      homeId: home.id,
    });
  });

  it("trims the name and refuses a blank one", async () => {
    expect(await submit(createRecipeCategory, { name: "  Baking  " })).toEqual({ ok: true });
    expect((await prisma.recipeCategory.findFirstOrThrow()).name).toBe("Baking");

    expect(await submit(createRecipeCategory, { name: "   " })).toEqual({
      ok: false,
      error: "Give the category a name.",
    });
    expect(await prisma.recipeCategory.count()).toBe(1);
  });

  // Two headings with one name would be indistinguishable in the picker, so the unique
  // index refuses the second — and the admin is told why rather than shown a crash.
  it("reports a name this home already uses", async () => {
    await submit(createRecipeCategory, { name: "Baking" });

    expect(await submit(createRecipeCategory, { name: "Baking" })).toEqual({
      ok: false,
      error: "There is already a category called “Baking”.",
    });
    expect(await prisma.recipeCategory.count()).toBe(1);
  });

  it("lets a different home use the same name", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    await seedCategory({ homeId: neighbour.id, name: "Baking" });

    expect(await submit(createRecipeCategory, { name: "Baking" })).toEqual({ ok: true });
    expect(await prisma.recipeCategory.count()).toBe(2);
  });

  it("turns a plain member away before anything is written", async () => {
    await signIn(member);

    await expectRedirect(() => submit(createRecipeCategory, { name: "Baking" }), "/dashboard");

    expect(await prisma.recipeCategory.count()).toBe(0);
  });
});

describe("renameRecipeCategory", () => {
  it("renames the category", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });

    expect(
      await submit(renameRecipeCategory, { categoryId: category.id, name: "Cakes" }),
    ).toEqual({ ok: true });

    expect((await prisma.recipeCategory.findFirstOrThrow()).name).toBe("Cakes");
  });

  it("reports a clash with another category in the same home", async () => {
    const baking = await seedCategory({ homeId: home.id, name: "Baking" });
    await seedCategory({ homeId: home.id, name: "Weeknight" });

    expect(
      await submit(renameRecipeCategory, { categoryId: baking.id, name: "Weeknight" }),
    ).toEqual({ ok: false, error: "There is already a category called “Weeknight”." });

    expect((await prisma.recipeCategory.findUniqueOrThrow({ where: { id: baking.id } })).name).toBe(
      "Baking",
    );
  });

  it("refuses to blank out a name", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });

    expect(await submit(renameRecipeCategory, { categoryId: category.id, name: "  " })).toEqual({
      ok: false,
      error: "Give the category a name.",
    });
    expect((await prisma.recipeCategory.findFirstOrThrow()).name).toBe("Baking");
  });

  it("cannot see another home's category", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await seedCategory({ homeId: neighbour.id, name: "Baking" });

    expect(await submit(renameRecipeCategory, { categoryId: theirs.id, name: "Hacked" })).toEqual({
      ok: false,
      error: "That category no longer exists.",
    });
    expect((await prisma.recipeCategory.findUniqueOrThrow({ where: { id: theirs.id } })).name).toBe(
      "Baking",
    );
  });
});

describe("deleteRecipeCategory", () => {
  it("removes a category nothing is filed under", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });

    await deleteRecipeCategory(formData({ categoryId: category.id }));

    expect(await prisma.recipeCategory.count()).toBe(0);
  });

  /*
   * Every recipe must have a category, so there is nothing sensible to do with what is
   * left behind. The page offers no Delete in this state; this is the check underneath
   * it, which is what a stale page or a hand-written submission meets.
   */
  it("leaves a category that still holds recipes", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });
    await createRecipe({ homeId: home.id, createdById: member.id, categoryId: category.id });

    await deleteRecipeCategory(formData({ categoryId: category.id }));

    expect(await prisma.recipeCategory.count()).toBe(1);
    expect(await prisma.recipe.count()).toBe(1);
  });

  it("cannot reach another home's category", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await seedCategory({ homeId: neighbour.id, name: "Baking" });

    await deleteRecipeCategory(formData({ categoryId: theirs.id }));

    expect(await prisma.recipeCategory.count()).toBe(1);
  });

  it("turns a plain member away", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });
    await signIn(member);

    await expectRedirect(
      () => deleteRecipeCategory(formData({ categoryId: category.id })),
      "/dashboard",
    );

    expect(await prisma.recipeCategory.count()).toBe(1);
  });
});

/*
 * Deleting a home removes its categories and its recipes in one cascading statement. A
 * Restrict on Recipe.categoryId would be checked the instant a category row went and
 * could fail depending on the order Postgres chose; NoAction is checked once the
 * statement is done. This test is the reason that choice is written down.
 */
describe("deleting a whole home", () => {
  it("takes its categories and recipes with it", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });
    await createRecipe({ homeId: home.id, createdById: member.id, categoryId: category.id });

    await prisma.home.delete({ where: { id: home.id } });

    expect(await prisma.recipe.count()).toBe(0);
    expect(await prisma.recipeCategory.count()).toBe(0);
  });
});

/** A super admin browsing a home maintains that home's categories, not another's. */
describe("a super admin with an active home", () => {
  it("adds categories to the home they are in", async () => {
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: home.id });
    await signIn(superAdmin);

    expect(await submit(createRecipeCategory, { name: "Baking" })).toEqual({ ok: true });

    expect((await prisma.recipeCategory.findFirstOrThrow()).homeId).toBe(home.id);
  });
});
