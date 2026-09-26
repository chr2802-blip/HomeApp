import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteRecipe, rateRecipe, resetRecipeRatings } from "@/app/actions/recipes";
import { ratingSummary } from "@/lib/rating";
import { createHome, createHomeWithMembers, createRecipe, createUser, formData, joinHome, signIn } from "../helpers/factories";
import { expectRedirect } from "../helpers/expect";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let admin: Awaited<ReturnType<typeof createHomeWithMembers>>["admin"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, admin, member } = await createHomeWithMembers());
  await signIn(member);
});

const ratingsOf = (recipeId: string) =>
  prisma.recipeRating.findMany({ where: { recipeId }, orderBy: { createdAt: "asc" } });

describe("rating a recipe", () => {
  it("adds a row every time, so the same person rating again moves the average", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: admin.id });

    await rateRecipe(formData({ recipeId: recipe.id, hearts: "5" }));
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "2" }));
    await signIn(admin);
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "4" }));

    const ratings = await ratingsOf(recipe.id);
    expect(ratings.map((rating) => [rating.userId, rating.hearts])).toEqual([
      [member.id, 5],
      [member.id, 2],
      [admin.id, 4],
    ]);
    expect(ratingSummary(ratings)).toEqual({ average: 11 / 3, count: 3 });
  });

  it.each(["0", "6", "3.5", "", "many"])("ignores %j hearts", async (hearts) => {
    const recipe = await createRecipe({ homeId: home.id, createdById: admin.id });

    await rateRecipe(formData({ recipeId: recipe.id, hearts }));

    expect(await ratingsOf(recipe.id)).toEqual([]);
  });

  it("keeps a rating when the person who gave it leaves", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: admin.id });
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "3" }));

    await prisma.user.delete({ where: { id: member.id } });

    const [rating] = await ratingsOf(recipe.id);
    expect(rating).toMatchObject({ hearts: 3, userId: null });
  });

  it("goes with the recipe", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: admin.id });
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "4" }));

    await expectRedirect(() => deleteRecipe(formData({ recipeId: recipe.id })), "/recipes");

    expect(await prisma.recipeRating.count()).toBe(0);
  });
});

describe("resetting a recipe's ratings", () => {
  it("clears every rating, everybody's, for an admin of the recipe's home", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: admin.id });
    const other = await createRecipe({ homeId: home.id, createdById: admin.id });
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "2" }));
    await rateRecipe(formData({ recipeId: other.id, hearts: "5" }));
    await signIn(admin);
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "4" }));

    await resetRecipeRatings(formData({ recipeId: recipe.id }));

    expect(await ratingsOf(recipe.id)).toEqual([]);
    expect(await ratingsOf(other.id)).toHaveLength(1);
  });

  it("is refused to a member who does not run the home", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: admin.id });
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "3" }));

    await expect(resetRecipeRatings(formData({ recipeId: recipe.id }))).rejects.toThrow("Not allowed");

    expect(await ratingsOf(recipe.id)).toHaveLength(1);
  });

  it("is refused to an admin of another home who merely lives in this one", async () => {
    const recipe = await createRecipe({ homeId: home.id, createdById: admin.id });
    await rateRecipe(formData({ recipeId: recipe.id, hearts: "3" }));
    const elsewhere = await createHome();
    const outsider = await createUser({ homeId: elsewhere.id, role: "ADMIN" });
    await joinHome({ userId: outsider.id, homeId: home.id, role: "USER" });
    await signIn(outsider);

    await expect(resetRecipeRatings(formData({ recipeId: recipe.id }))).rejects.toThrow("Not allowed");

    expect(await ratingsOf(recipe.id)).toHaveLength(1);
  });
});
