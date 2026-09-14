import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteList, updateList, toggleListFavorite, toggleListItem } from "@/app/actions/lists";
import { completeTask, deleteTask, updateTask } from "@/app/actions/tasks";
import { createRecipe as saveRecipe, deleteRecipe, updateRecipe } from "@/app/actions/recipes";
import {
  deleteRecipeCategory,
  renameRecipeCategory,
} from "@/app/actions/recipe-categories";
import { createInvite, removeMember, updateHome, updateMemberRole } from "@/app/actions/admin";
import {
  createHome,
  createList,
  createRecipe,
  createRecipeCategory,
  createTask,
  createUser,
  formData,
  signIn,
  signOut,
} from "../helpers/factories";
import { expectDenied, expectRedirect, expectRedirectToLogin } from "../helpers/expect";

/**
 * Every home's data must be invisible to every other home. These tests drive the real
 * server actions with a valid session from the wrong home, which is the shape an
 * attack would take: a genuine account guessing another home's record id.
 */
describe("a member of one home cannot touch another home's data", () => {
  let intruder: Awaited<ReturnType<typeof createUser>>;
  let victimHome: Awaited<ReturnType<typeof createHome>>;
  let victimOwner: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    const intruderHome = await createHome({ name: "Intruder House" });
    intruder = await createUser({ homeId: intruderHome.id, role: "ADMIN" });

    victimHome = await createHome({ name: "Victim House" });
    victimOwner = await createUser({ homeId: victimHome.id, role: "ADMIN" });

    await signIn(intruder);
  });

  it("cannot favourite another home's list", async () => {
    const list = await createList({ homeId: victimHome.id, createdById: victimOwner.id });

    await expectDenied(() => toggleListFavorite(formData({ listId: list.id })));

    expect(await prisma.listFavorite.count()).toBe(0);
  });

  it("cannot rename another home's list", async () => {
    const list = await createList({ homeId: victimHome.id, createdById: victimOwner.id });

    await expectDenied(() => updateList(undefined, formData({ listId: list.id, title: "Hacked" })));

    expect((await prisma.list.findUnique({ where: { id: list.id } }))?.title).toBe("Shopping");
  });

  it("cannot delete another home's list", async () => {
    const list = await createList({ homeId: victimHome.id, createdById: victimOwner.id });

    await expectDenied(() => deleteList(formData({ listId: list.id })));

    expect(await prisma.list.findUnique({ where: { id: list.id } })).not.toBeNull();
  });

  it("cannot tick off an item on another home's list", async () => {
    const list = await createList({ homeId: victimHome.id, createdById: victimOwner.id });
    const item = await prisma.listItem.create({
      data: { listId: list.id, text: "Milk", position: 1 },
    });

    await expectDenied(() => toggleListItem(formData({ itemId: item.id })));

    expect((await prisma.listItem.findUnique({ where: { id: item.id } }))?.done).toBe(false);
  });

  it("cannot complete, edit or delete another home's task", async () => {
    const task = await createTask({ homeId: victimHome.id, createdById: victimOwner.id });

    await expectDenied(() => completeTask(formData({ taskId: task.id })));
    await expectDenied(() =>
      updateTask(undefined, formData({ taskId: task.id, title: "Hacked", intervalDays: "1" })),
    );
    await expectDenied(() => deleteTask(formData({ taskId: task.id })));

    const after = await prisma.recurringTask.findUnique({ where: { id: task.id } });
    expect(after).toMatchObject({ title: "Water the plants", lastCompletedAt: null });
  });

  it("cannot edit or delete another home's recipe", async () => {
    const recipe = await createRecipe({ homeId: victimHome.id, createdById: victimOwner.id });

    await expectDenied(() =>
      updateRecipe(
        undefined,
        formData({
          recipeId: recipe.id,
          categoryId: recipe.categoryId,
          title: "Hacked",
          ingredients: "",
          instructions: "",
        }),
      ),
    );
    await expectDenied(() => deleteRecipe(formData({ recipeId: recipe.id })));

    expect((await prisma.recipe.findUnique({ where: { id: recipe.id } }))?.title).toBe("Pancakes");
  });

  it("cannot rename or delete another home's recipe category", async () => {
    const category = await createRecipeCategory({ homeId: victimHome.id, name: "Baking" });

    // Scoped out of sight rather than refused: the intruder is an admin of their own
    // home, so the answer they get is that no such category exists.
    expect(
      await renameRecipeCategory(undefined, formData({ categoryId: category.id, name: "Hacked" })),
    ).toEqual({ ok: false, error: "That category no longer exists." });
    await deleteRecipeCategory(formData({ categoryId: category.id }));

    expect(
      (await prisma.recipeCategory.findUnique({ where: { id: category.id } }))?.name,
    ).toBe("Baking");
  });

  it("cannot file a recipe under another home's category", async () => {
    const category = await createRecipeCategory({ homeId: victimHome.id, name: "Baking" });

    const result = await saveRecipe(
      undefined,
      formData({ title: "Trojan", categoryId: category.id, ingredients: "", instructions: "" }),
    );

    expect(result).toEqual({ ok: false, error: "Choose a category for this recipe." });
    expect(await prisma.recipe.count()).toBe(0);
  });

  it("cannot rename another home", async () => {
    await expectDenied(() => updateHome(undefined, formData({ homeId: victimHome.id, name: "Hacked" })));

    expect((await prisma.home.findUnique({ where: { id: victimHome.id } }))?.name).toBe(
      "Victim House",
    );
  });

  it("cannot invite anyone into another home", async () => {
    const result = await createInvite(
      undefined,
      formData({ homeId: victimHome.id, email: "plant@example.com", role: "ADMIN" }),
    );

    expect(result).toEqual({ ok: false, error: "Not allowed." });
    expect(await prisma.invite.count()).toBe(0);
  });

  it("cannot change a role or remove a member in another home", async () => {
    const victimMember = await createUser({ homeId: victimHome.id, role: "USER" });

    await expectDenied(() =>
      updateMemberRole(formData({ userId: victimMember.id, role: "ADMIN" })),
    );
    await expectDenied(() => removeMember(formData({ userId: victimMember.id })));

    const after = await prisma.user.findUnique({ where: { id: victimMember.id } });
    expect(after).toMatchObject({ role: "USER" });
  });
});

describe("a super admin reaches every home", () => {
  it("can edit a home it is not a member of", async () => {
    const home = await createHome({ name: "Someone Else's House" });
    const owner = await createUser({ homeId: home.id, role: "ADMIN" });
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await updateHome(undefined, formData({ homeId: home.id, name: "Renamed By Super Admin" }));

    expect((await prisma.home.findUnique({ where: { id: home.id } }))?.name).toBe(
      "Renamed By Super Admin",
    );
    expect(owner.homeId).toBe(home.id);
  });

  it("can act on another home's task", async () => {
    const home = await createHome();
    const owner = await createUser({ homeId: home.id });
    const task = await createTask({ homeId: home.id, createdById: owner.id });

    // A super admin browsing a home has that home as their active home.
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: home.id });
    await signIn(superAdmin);

    await completeTask(formData({ taskId: task.id }));

    expect(
      (await prisma.recurringTask.findUnique({ where: { id: task.id } }))?.lastCompletedAt,
    ).toBeInstanceOf(Date);
  });
});

describe("a plain member cannot administer their own home", () => {
  it("is bounced off the admin actions before anything changes", async () => {
    const home = await createHome();
    const member = await createUser({ homeId: home.id, role: "USER" });
    const other = await createUser({ homeId: home.id, role: "USER" });
    await signIn(member);

    // requireAdmin sends a non-admin away rather than reporting a permission error.
    await expectRedirect(
      () => updateMemberRole(formData({ userId: other.id, role: "ADMIN" })),
      "/dashboard",
    );
    await expectRedirect(() => removeMember(formData({ userId: other.id })), "/dashboard");

    expect((await prisma.user.findUnique({ where: { id: other.id } }))?.role).toBe("USER");
  });
});

describe("signed-out visitors", () => {
  beforeEach(() => signOut());

  it("are sent to the login page instead of reaching any data", async () => {
    const home = await createHome();
    const owner = await createUser({ homeId: home.id });
    const list = await createList({ homeId: home.id, createdById: owner.id });
    const task = await createTask({ homeId: home.id, createdById: owner.id });
    const recipe = await createRecipe({ homeId: home.id, createdById: owner.id });

    await expectRedirectToLogin(() => updateList(undefined, formData({ listId: list.id, title: "x" })));
    await expectRedirectToLogin(() => completeTask(formData({ taskId: task.id })));
    await expectRedirectToLogin(() => deleteRecipe(formData({ recipeId: recipe.id })));
    await expectRedirectToLogin(() => updateHome(undefined, formData({ homeId: home.id, name: "x" })));
  });
});
