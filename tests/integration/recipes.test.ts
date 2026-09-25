import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRecipe, deleteRecipe, prepareRecipeSteps, updateRecipe } from "@/app/actions/recipes";
import { MONTHLY_LIMIT_USD } from "@/lib/ai-usage";
import { attemptsAllowed } from "@/lib/rate-limit";
import { RECIPES } from "@/lib/copy/recipes";
import { IN_FORMAT } from "@/lib/cook";
import { READING_FIELD } from "@/lib/recipes";
import { signReading } from "@/lib/reading-token";
import {
  createHome,
  createHomeWithMembers,
  createRecipe as seedRecipe,
  createRecipeCategory,
  formData,
  signIn,
} from "../helpers/factories";
import { captureRedirect, expectRedirect } from "../helpers/expect";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let category: Awaited<ReturnType<typeof createRecipeCategory>>;

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  category = await createRecipeCategory({ homeId: home.id, name: "Baking" });
  await signIn(member);
});

const only = () => prisma.recipe.findFirstOrThrow();

/** The categories the one recipe is filed under, as ids. */
const filedUnder = async () =>
  (
    await prisma.recipeCategoryLink.findMany({
      where: { recipeId: (await only()).id },
      select: { categoryId: true },
    })
  ).map((link) => link.categoryId);

describe("createRecipe", () => {
  it("saves the recipe in the caller's home and opens it", async () => {
    const destination = await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pancakes",
          categoryIds: [category.id],
          description: "Sunday breakfast",
          ingredients: "Flour\nMilk\nEggs",
          instructions: "Mix.\nFry.",
        }),
      ),
    );

    const recipe = await only();
    expect(await filedUnder()).toEqual([category.id]);
    expect(recipe).toMatchObject({
      title: "Pancakes",
      description: "Sunday breakfast",
      ingredients: "Flour\nMilk\nEggs",
      instructions: "Mix.\nFry.",
      homeId: home.id,
      createdById: member.id,
    });
    expect(destination).toBe(`/recipes/${recipe.id}`);
  });

  it("keeps a valid video link", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: "",
          instructions: "",
          videoUrl: "https://www.instagram.com/reel/AbC123/",
        }),
      ),
    );

    expect((await only()).videoUrl).toBe("https://www.instagram.com/reel/AbC123/");
  });

  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["nonsense", "not a url"],
  ])("refuses a %s video link instead of silently dropping it", async (_label, videoUrl) => {
    const result = await createRecipe(
      undefined,
      formData({ title: "Pasta", categoryIds: [category.id], ingredients: "", instructions: "", videoUrl }),
    );

    expect(result).toEqual({ ok: false, error: "That video link is not a valid web address." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  it("accepts a recipe with no video link at all", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({ title: "Pasta", categoryIds: [category.id], ingredients: "", instructions: "", videoUrl: "" }),
      ),
    );

    expect((await only()).videoUrl).toBeNull();
  });

  it("stores the total time when one is given", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: "",
          instructions: "",
          totalTimeMinutes: "25",
        }),
      ),
    );

    expect((await only()).totalTimeMinutes).toBe(25);
  });

  it("stores a blank total time as null", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({ title: "Pasta", categoryIds: [category.id], ingredients: "", instructions: "" }),
      ),
    );

    expect((await only()).totalTimeMinutes).toBeNull();
  });

  it.each(["0", "-5", "not a number"])(
    "refuses a total time of %s instead of silently dropping it",
    async (totalTimeMinutes) => {
      const result = await createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: "",
          instructions: "",
          totalTimeMinutes,
        }),
      );

      expect(result).toEqual({ ok: false, error: "Time must be a whole number of minutes." });
      expect(await prisma.recipe.count()).toBe(0);
    },
  );

  it("stores a blank description as null", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({ title: "Pasta", categoryIds: [category.id], description: "  ", ingredients: "", instructions: "" }),
      ),
    );

    expect((await only()).description).toBeNull();
  });

  it("files a recipe under every category that was chosen", async () => {
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });

    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Lasagne",
          categoryIds: [category.id, weeknight.id],
          ingredients: "",
          instructions: "",
        }),
      ),
    );

    expect((await filedUnder()).sort()).toEqual([category.id, weeknight.id].sort());
  });

  /*
   * A box cannot be ticked twice, so a repeated id means a submission that did not come
   * from the picker. Filing it once is the same answer as filing it once per tick, and
   * the pairings table would refuse the second row anyway.
   */
  it("files a recipe once under a category named twice", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pancakes",
          categoryIds: [category.id, category.id],
          ingredients: "",
          instructions: "",
        }),
      ),
    );

    expect(await filedUnder()).toEqual([category.id]);
  });

  it("refuses a recipe filed under one category it may see and one it may not", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await createRecipeCategory({ homeId: neighbour.id, name: "Theirs" });

    const result = await createRecipe(
      undefined,
      formData({
        title: "Trojan",
        categoryIds: [category.id, theirs.id],
        ingredients: "",
        instructions: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  it("refuses a recipe with no category", async () => {
    const result = await createRecipe(
      undefined,
      formData({ title: "Pasta", ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  /*
   * The picker only ever offers this home's categories, so reaching here means either a
   * stale page or a hand-written submission. Either way the recipe must not end up filed
   * under a heading its household cannot see or rename.
   */
  it("refuses to file a recipe under another home's category", async () => {
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await createRecipeCategory({ homeId: neighbour.id, name: "Baking" });

    const result = await createRecipe(
      undefined,
      formData({ title: "Pasta", categoryIds: [theirs.id], ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  it("ignores a recipe with no title", async () => {
    await createRecipe(
      undefined,
      formData({ title: "  ", categoryIds: [category.id], ingredients: "x", instructions: "y" }),
    );

    expect(await prisma.recipe.count()).toBe(0);
  });
});

describe("updateRecipe", () => {
  it("replaces every field", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Better pancakes",
            description: "Improved",
            ingredients: "Flour\nButtermilk",
            instructions: "Rest the batter.",
            videoUrl: "https://youtu.be/dQw4w9WgXcQ",
            totalTimeMinutes: "40",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect(await only()).toMatchObject({
      title: "Better pancakes",
      description: "Improved",
      ingredients: "Flour\nButtermilk",
      instructions: "Rest the batter.",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      totalTimeMinutes: 40,
    });
  });

  it("clears a total time that is removed", async () => {
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id],
      totalTimeMinutes: 45,
    });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Pancakes",
            ingredients: "",
            instructions: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect((await only()).totalTimeMinutes).toBeNull();
  });

  it("clears a video link that is removed", async () => {
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id],
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Pancakes",
            ingredients: "",
            instructions: "",
            videoUrl: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect((await only()).videoUrl).toBeNull();
  });

  it("refuses to blank out the title", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    await updateRecipe(
      undefined,
      formData({ recipeId: recipe.id, categoryIds: [category.id], title: "   ", ingredients: "", instructions: "" }),
    );

    expect((await only()).title).toBe("Pancakes");
  });

  it("moves a recipe to a different category", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [weeknight.id],
            title: "Pancakes",
            ingredients: "",
            instructions: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect(await filedUnder()).toEqual([weeknight.id]);
  });

  it("replaces the whole set of categories, keeping the ones ticked again", async () => {
    const weeknight = await createRecipeCategory({ homeId: home.id, name: "Weeknight" });
    const italian = await createRecipeCategory({ homeId: home.id, name: "Italian" });
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id, weeknight.id],
    });

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            // Baking goes, Weeknight stays, Italian is added.
            categoryIds: [weeknight.id, italian.id],
            title: "Lasagne",
            ingredients: "",
            instructions: "",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect((await filedUnder()).sort()).toEqual([italian.id, weeknight.id].sort());
  });

  it("refuses to leave a recipe filed under nothing", async () => {
    const recipe = await seedRecipe({
      homeId: home.id,
      createdById: member.id,
      categoryIds: [category.id],
    });

    const result = await updateRecipe(
      undefined,
      formData({ recipeId: recipe.id, title: "Pancakes", ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await filedUnder()).toEqual([category.id]);
  });

  it("refuses to move a recipe into another home's category", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });
    const neighbour = await createHome({ name: "Next Door" });
    const theirs = await createRecipeCategory({ homeId: neighbour.id, name: "Baking" });

    const result = await updateRecipe(
      undefined,
      formData({
        recipeId: recipe.id,
        categoryIds: [theirs.id],
        title: "Pancakes",
        ingredients: "",
        instructions: "",
      }),
    );

    expect(result).toEqual({ ok: false, error: "Choose at least one category for this recipe." });
    expect(await filedUnder()).toEqual([category.id]);
  });

  it("fails loudly for a recipe that does not exist", async () => {
    await expect(
      updateRecipe(
        undefined,
        formData({ recipeId: "missing", categoryIds: [category.id], title: "x", ingredients: "", instructions: "" }),
      ),
    ).rejects.toThrow("Recipe not found");
  });
});

describe("deleteRecipe", () => {
  it("removes the recipe and returns to the index", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    await expectRedirect(() => deleteRecipe(formData({ recipeId: recipe.id })), "/recipes");

    expect(await prisma.recipe.count()).toBe(0);
  });
});

/**
 * The one invariant action mode rests on: **a write that changes `ingredients` or
 * `instructions` also writes `cookSteps`.**
 *
 * The breakdown points at ingredient lines by their position and holds one entry per
 * line of instructions, so one left behind by an edit would put another ingredient under
 * a step — at the hob, with nothing failing anywhere. `lib/cook.ts` refuses a mapping
 * whose length has drifted, but that is the net; this is the mechanism, and these are the
 * assertions that it is actually wired to both halves of a save.
 *
 * There is no `ANTHROPIC_API_KEY` in this suite, so every preparation here comes back
 * unavailable — which is the interesting half anyway. A reader that cannot answer must
 * clear the column rather than leave what was there, and the recipe must still save.
 */
describe("what a save leaves in cookSteps", () => {
  const prepared = { v: 1, steps: [{ uses: [0], minutes: 10 }] };

  /** A recipe already carrying a breakdown of its one stored step, "Mix and fry.". */
  async function seedPrepared() {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { cookSteps: prepared } });
    return recipe;
  }

  const edit = (recipe: { id: string }, fields: Record<string, string>) =>
    expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Pancakes",
            ingredients: "Flour\nMilk",
            instructions: "Mix and fry.",
            ...fields,
          }),
        ),
      `/recipes/${recipe.id}`,
    );

  it("clears a breakdown whose steps have been rewritten", async () => {
    const recipe = await seedPrepared();

    await edit(recipe, { instructions: "Mix.\nFry." });

    expect((await only()).cookSteps).toBeNull();
  });

  /*
   * Positions, not names: inserting a line at the top of the ingredients moves every
   * index by one without touching a step. Nothing about the instructions has changed, and
   * the breakdown is wrong about all of them.
   */
  it("clears a breakdown whose ingredients have moved under it", async () => {
    const recipe = await seedPrepared();

    await edit(recipe, { ingredients: "Salt\nFlour\nMilk" });

    expect((await only()).cookSteps).toBeNull();
  });

  /*
   * A recipe never read into the one ingredient format is read on any save, even one that
   * changed neither block: that is how a recipe stored before the format existed is
   * brought into it — edit anything, save. With no reader to answer here, it stores the
   * recipe as written and clears the breakdown, exactly as any other save would.
   */
  it("reads a recipe from before the format on a save that changed neither block", async () => {
    const recipe = await seedPrepared();

    await edit(recipe, { title: "Better pancakes", description: "Improved" });

    expect(await only()).toMatchObject({ title: "Better pancakes", ingredients: "Flour\nMilk", cookSteps: null });
  });

  /*
   * One already in the format costs no reading where its text was left alone: a title, a
   * picture or a category is nothing the reader looks at. The breakdown is left exactly as
   * it was — with no reader here, a reading would have cleared it.
   */
  it("leaves a recipe already in the format alone where neither block changed", async () => {
    const recipe = await seedPrepared();
    const inFormat = { v: IN_FORMAT, steps: prepared.steps };
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { ingredients: "Flour\nMilk", instructions: "Mix and fry.", cookSteps: inFormat },
    });

    // A textarea sends its lines back with `\r\n`; that is the same text.
    await edit(recipe, { title: "Better pancakes", ingredients: "Flour\r\nMilk\r\n" });

    expect(await only()).toMatchObject({ title: "Better pancakes", cookSteps: inFormat });
  });

  it("still reads a recipe already in the format once a block has changed", async () => {
    const recipe = await seedPrepared();
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { ingredients: "Flour\nMilk", instructions: "Mix and fry.", cookSteps: { v: IN_FORMAT, steps: prepared.steps } },
    });

    await edit(recipe, { ingredients: "Flour\nMilk\nSalt" });

    expect((await only()).cookSteps).toBeNull();
  });

  it("saves the recipe anyway when the reader cannot answer", async () => {
    const recipe = await seedPrepared();

    await edit(recipe, { instructions: "Mix.\nFry.", title: "Better pancakes" });

    expect(await only()).toMatchObject({ title: "Better pancakes", instructions: "Mix.\nFry." });
  });

  /*
   * An import saved untouched is stored as the importer read it: the form carries the
   * importer's signed reading, and the save needs no reader to answer — there is none
   * here, and the breakdown arrives anyway.
   */
  it("stores an import saved untouched as the importer read it, without reading it again", async () => {
    const imported = { ingredients: "400 g pasta\nsalt", instructions: "Kog pastaen.\nSmag til med salt.", steps: [{ uses: [0], minutes: 10 }, { uses: [1], minutes: null }] };

    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: imported.ingredients,
          instructions: imported.instructions,
          [READING_FIELD]: signReading(home.id, imported)!,
        }),
      ),
    );

    expect(await only()).toMatchObject({
      ingredients: imported.ingredients,
      cookSteps: { v: IN_FORMAT, steps: imported.steps },
    });
  });

  it("reads an import whose text was edited before saving, as it would anything typed", async () => {
    const imported = { ingredients: "400 g pasta", instructions: "Kog pastaen.", steps: [{ uses: [0], minutes: 10 }] };

    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Pasta",
          categoryIds: [category.id],
          ingredients: "400 g pasta, kogt al dente",
          instructions: imported.instructions,
          [READING_FIELD]: signReading(home.id, imported)!,
        }),
      ),
    );

    // No reader here, so what was typed is stored as typed — and nothing vouches for it.
    expect(await only()).toMatchObject({ ingredients: "400 g pasta, kogt al dente", cookSteps: null });
  });

  it("writes nothing for a recipe created while the reader is down", async () => {
    await captureRedirect(() =>
      createRecipe(
        undefined,
        formData({
          title: "Boller",
          categoryIds: [category.id],
          ingredients: "Mel",
          instructions: "Ælt.\nBag.",
        }),
      ),
    );

    const recipe = await only();
    expect(recipe.cookSteps).toBeNull();
    // The cook's own steps survive untouched — a reader that could not read them has no
    // opinion about them.
    expect(recipe.instructions).toBe("Ælt.\nBag.");
  });
});

/**
 * The two ways into a paid model call besides the importer: a save, and the "prepare"
 * button. Both are counted against the person pressing, and both are
 * refused once the home has spent its month — the second of which is asked inside the
 * reader, so these need a key in the environment to get that far. Nothing reaches the
 * network: every case here is turned away before a client is built.
 */
describe("what bounds a call to the reader", () => {
  const press = (recipeId: string) => prepareRecipeSteps(undefined, formData({ recipeId }));

  afterEach(() => vi.unstubAllEnvs());

  it("turns a preparation past the quarter-hour's allowance away, and says when to come back", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });

    for (let i = 0; i < attemptsAllowed("prepare"); i++) {
      expect(await press(recipe.id)).toEqual({ ok: false, error: RECIPES.prepareReaderUnavailable.EN });
    }

    expect(await press(recipe.id)).toEqual({
      ok: false,
      error: expect.stringMatching(/^That's a lot of preparing at once\. Try again in \d+ min\.$/),
    });
  });

  // A save over the limit degrades without saying so, so the limit is set where a
  // household tidying old recipes for an evening does not meet it — well past the
  // guess-a-password eight the other scopes use. The money is the monthly allowance's.
  it("allows an evening's worth of saves, not a password-guesser's", () => {
    expect(attemptsAllowed("prepare")).toBeGreaterThanOrEqual(30);
    expect(attemptsAllowed("login")).toBe(8);
  });

  it("still saves a recipe once its author is over the limit, and clears its breakdown", async () => {
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });
    await prisma.recipe.update({ where: { id: recipe.id }, data: { cookSteps: { v: 1, steps: [{ uses: [0], minutes: null }] } } });
    for (let i = 0; i < attemptsAllowed("prepare"); i++) await press(recipe.id);

    await expectRedirect(
      () =>
        updateRecipe(
          undefined,
          formData({
            recipeId: recipe.id,
            categoryIds: [category.id],
            title: "Pancakes",
            ingredients: "Flour\nMilk",
            instructions: "Mix.\nFry.",
          }),
        ),
      `/recipes/${recipe.id}`,
    );

    expect(await only()).toMatchObject({ instructions: "Mix.\nFry.", cookSteps: null });
  });

  it("tells a home past its month's allowance so, rather than to try again in a moment", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "never-sent");
    const recipe = await seedRecipe({ homeId: home.id, createdById: member.id, categoryIds: [category.id] });
    await prisma.aiUsage.create({
      data: {
        homeId: home.id,
        feature: "cook_steps",
        model: "claude-sonnet-5",
        inputTokens: 0,
        outputTokens: 0,
        costMicros: MONTHLY_LIMIT_USD * 1_000_000,
      },
    });

    expect(await press(recipe.id)).toEqual({ ok: false, error: RECIPES.prepareOverLimit.EN });
  });
});
