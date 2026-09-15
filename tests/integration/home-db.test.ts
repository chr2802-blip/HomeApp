import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { homeDb } from "@/lib/home-db";
import { createHome, createList, createRecipe, createTask, createUser } from "../helpers/factories";

/**
 * The point of homeDb is that a query which forgets to mention the home still cannot
 * see another one. Every test here deliberately omits the clause a careful author
 * would have written.
 */
async function twoHomes() {
  const ours = await createHome({ name: "Ours" });
  const theirs = await createHome({ name: "Theirs" });
  const us = await createUser({ homeId: ours.id });
  const them = await createUser({ homeId: theirs.id });

  await createList({ homeId: ours.id, createdById: us.id, title: "Our shopping" });
  await createList({ homeId: theirs.id, createdById: them.id, title: "Their shopping" });

  return { ours, theirs, us, them };
}

describe("reading", () => {
  it("returns only this home's rows from an unfiltered findMany", async () => {
    const { ours } = await twoHomes();

    const lists = await homeDb(ours.id).list.findMany();

    expect(lists.map((list) => list.title)).toEqual(["Our shopping"]);
  });

  it("counts only this home's rows", async () => {
    const { ours } = await twoHomes();

    expect(await homeDb(ours.id).list.count()).toBe(1);
    expect(await prisma.list.count()).toBe(2); // both really are there
  });

  it("cannot fetch another home's record by its id", async () => {
    const { ours, theirs, them } = await twoHomes();
    const hidden = await createList({ homeId: theirs.id, createdById: them.id, title: "Private" });

    expect(await homeDb(ours.id).list.findUnique({ where: { id: hidden.id } })).toBeNull();
    expect(await homeDb(theirs.id).list.findUnique({ where: { id: hidden.id } })).not.toBeNull();
  });

  it("keeps a caller's own filters alongside the home", async () => {
    const { ours, us } = await twoHomes();
    await createList({ homeId: ours.id, createdById: us.id, title: "Hardware" });

    const found = await homeDb(ours.id).list.findMany({ where: { title: "Hardware" } });

    expect(found).toHaveLength(1);
  });

  it("scopes tasks, recipes and members the same way", async () => {
    const { ours, theirs, us, them } = await twoHomes();
    await createTask({ homeId: ours.id, createdById: us.id });
    await createTask({ homeId: theirs.id, createdById: them.id });
    await createRecipe({ homeId: ours.id, createdById: us.id });
    await createRecipe({ homeId: theirs.id, createdById: them.id });

    const db = homeDb(ours.id);
    expect(await db.task.count()).toBe(1);
    expect(await db.recipe.count()).toBe(1);
    expect(await db.user.count()).toBe(1);
  });
});

describe("writing", () => {
  it("stamps a created row with this home", async () => {
    const { ours, us } = await twoHomes();

    // TypeScript still asks for homeId; the scoped client is what supplies it, so the
    // argument is cast to prove the runtime does the work.
    const list = await homeDb(ours.id).list.create({
      data: { title: "Stamped", createdById: us.id },
    } as Parameters<typeof prisma.list.create>[0]);

    expect(list.homeId).toBe(ours.id);
  });

  it("overrides a home id the caller got wrong", async () => {
    const { ours, theirs, us } = await twoHomes();

    const list = await homeDb(ours.id).list.create({
      data: { title: "Misfiled", createdById: us.id, homeId: theirs.id },
    });

    expect(list.homeId).toBe(ours.id);
  });

  it("cannot update another home's record", async () => {
    const { ours, theirs, them } = await twoHomes();
    const hidden = await createList({ homeId: theirs.id, createdById: them.id, title: "Private" });

    await expect(
      homeDb(ours.id).list.update({ where: { id: hidden.id }, data: { title: "Taken" } }),
    ).rejects.toMatchObject({ code: "P2025" });

    expect((await prisma.list.findUniqueOrThrow({ where: { id: hidden.id } })).title).toBe("Private");
  });

  it("cannot delete another home's record", async () => {
    const { ours, theirs, them } = await twoHomes();
    const hidden = await createList({ homeId: theirs.id, createdById: them.id, title: "Private" });

    await expect(
      homeDb(ours.id).list.delete({ where: { id: hidden.id } }),
    ).rejects.toMatchObject({ code: "P2025" });

    expect(await prisma.list.count({ where: { id: hidden.id } })).toBe(1);
  });

  it("cannot empty another home with an unfiltered deleteMany", async () => {
    const { ours } = await twoHomes();

    await homeDb(ours.id).list.deleteMany();

    expect(await prisma.list.count()).toBe(1);
    expect((await prisma.list.findFirstOrThrow()).title).toBe("Their shopping");
  });
});

describe("models that belong to nobody", () => {
  it("leaves a model without a home alone", async () => {
    const { ours, us } = await twoHomes();
    await prisma.pushSubscription.create({
      data: { userId: us.id, endpoint: "https://push.test/a", p256dh: "k", auth: "a" },
    });

    // PushSubscription has no homeId; scoping it would be a query error.
    expect(await homeDb(ours.id).pushSubscription.count()).toBe(1);
  });

  it("leaves homes themselves alone", async () => {
    const { ours } = await twoHomes();

    expect(await homeDb(ours.id).home.count()).toBe(2);
  });
});
