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
   * A recipe filed only under this heading would be left filed under none, and so would
   * be saved but absent from the page that lists the household's recipes. The page
   * offers no Delete in this state; this is the check underneath it, which is what a
   * stale page or a hand-written submission meets.
   */
  it("leaves a category that still holds recipes", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });
    await createRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    await deleteRecipeCategory(formData({ categoryId: category.id }));

    expect(await prisma.recipeCategory.count()).toBe(1);
    expect(await prisma.recipe.count()).toBe(1);
  });

  /*
   * The recipe would survive losing this heading, since it has another — but the
   * database refuses either way, and an admin who wants the category gone can untick it
   * on the recipes that use it first. Deleting headings out from under recipes is not a
   * thing to make easy.
   */
  it("leaves a category held by a recipe that has other categories too", async () => {
    const baking = await seedCategory({ homeId: home.id, name: "Baking" });
    const weeknight = await seedCategory({ homeId: home.id, name: "Weeknight" });
    await createRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [baking.id, weeknight.id],
    });

    await deleteRecipeCategory(formData({ categoryId: baking.id }));

    expect(await prisma.recipeCategory.count()).toBe(2);
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
 * Deleting a home removes its categories, its recipes and the pairings between them in
 * one cascading statement. A Restrict on RecipeCategoryLink.categoryId would be checked
 * the instant a category row went and could fail depending on the order Postgres chose;
 * NoAction is checked once the statement is done. This test is the reason that choice is
 * written down.
 */
describe("deleting a whole home", () => {
  it("takes its categories and recipes with it", async () => {
    const category = await seedCategory({ homeId: home.id, name: "Baking" });
    await createRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

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
