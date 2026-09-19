import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getHomeStorage, getInstallationStorage } from "@/lib/storage";
import { pngBytes } from "../helpers/images";
import {
  createHome,
  createList,
  createRecipe,
  createTask,
  createUser,
  joinHome,
} from "../helpers/factories";

/**
 * A picture, and how much of it there is to find.
 *
 * Noisy so the PNG does not deflate away to nothing, and weighed by its own two blobs
 * rather than against a number written here: the figures this module produces are what
 * Postgres says a row occupies *after* its own compression, so the only assertion worth
 * making is that the bytes that went in are the bytes that turn up — near enough that a
 * second copy of a picture could not hide in the difference.
 */
async function storedPhoto(homeId: string) {
  const bytes = pngBytes(600, 600, { noisy: true });
  const thumbBytes = pngBytes(60, 60, { noisy: true });

  const photo = await prisma.photo.create({
    data: {
      homeId,
      contentType: "image/png",
      width: 600,
      height: 600,
      bytes,
      thumbWidth: 60,
      thumbHeight: 60,
      thumbBytes,
    },
  });

  return { id: photo.id, size: bytes.length + thumbBytes.length };
}

/** Both sides of "that is the picture and nothing else". */
function expectAbout(measured: number, size: number) {
  expect(measured).toBeGreaterThan(size * 0.9);
  expect(measured).toBeLessThan(size * 1.1 + 2_000);
}

async function homeWithOwner() {
  const home = await createHome();
  const user = await createUser({ homeId: home.id, role: "ADMIN" });
  return { home, user };
}

describe("a home's storage", () => {
  it("weighs something even with nothing in it", async () => {
    // The home record, and whoever is in it. A brand-new household reading "0 B" would
    // look like a measurement that had not run rather than like an empty home.
    const { home } = await homeWithOwner();

    const storage = await getHomeStorage(home.id);

    expect(storage.total).toBeGreaterThan(0);
    expect(storage.kinds.rest).toBe(storage.total);
    expect(storage.kinds).toMatchObject({ recipes: 0, lists: 0, tasks: 0 });
  });

  it("charges a picture to the thing that is showing it", async () => {
    const { home, user } = await homeWithOwner();
    const recipe = await createRecipe({ homeId: home.id, createdById: user.id });
    const photo = await storedPhoto(home.id);

    const before = await getHomeStorage(home.id);
    await prisma.recipe.update({ where: { id: recipe.id }, data: { photoId: photo.id } });
    const after = await getHomeStorage(home.id);

    // Nothing else was written, so the picture is the whole of the difference: it left
    // "everything else", where an upload nobody has attached to anything sits, for the
    // recipe that is now showing it.
    const moved = before.kinds.rest - after.kinds.rest;
    expectAbout(moved, photo.size);

    // The two sides do not match to the byte, and that is the measurement working. The
    // recipe row grew by the width of the photo id it now carries, where before it
    // carried a null and cost nothing — which is a real change in what the database
    // holds, and exactly the sort of thing a total counted off the columns by hand
    // would report as zero.
    expect(after.kinds.recipes - before.kinds.recipes).toBeGreaterThan(moved);
    expect(after.total - before.total).toBeLessThan(100);
  });

  it("splits the same way for a list and for a task", async () => {
    const { home, user } = await homeWithOwner();

    const list = await createList({ homeId: home.id, createdById: user.id });
    const listPhoto = await storedPhoto(home.id);
    await prisma.list.update({ where: { id: list.id }, data: { photoId: listPhoto.id } });

    const task = await createTask({ homeId: home.id, createdById: user.id });
    const taskPhoto = await storedPhoto(home.id);
    await prisma.task.update({ where: { id: task.id }, data: { photoId: taskPhoto.id } });

    const storage = await getHomeStorage(home.id);

    expectAbout(storage.kinds.lists, listPhoto.size);
    expectAbout(storage.kinds.tasks, taskPhoto.size);
    expect(storage.kinds.recipes).toBe(0);
  });

  it("keeps an upload nobody finished in everything else", async () => {
    // The sweep will take it within the hour; until then it is really stored, and a
    // total that pretended otherwise would not add up to what the database holds.
    const { home } = await homeWithOwner();
    const before = await getHomeStorage(home.id);

    const photo = await storedPhoto(home.id);
    const after = await getHomeStorage(home.id);

    expectAbout(after.kinds.rest - before.kinds.rest, photo.size);
    expect(after.kinds).toMatchObject({ recipes: 0, lists: 0, tasks: 0 });
  });

  it("counts a list's items and the recipes that put them there", async () => {
    const { home, user } = await homeWithOwner();
    const list = await createList({ homeId: home.id, createdById: user.id });
    const before = await getHomeStorage(home.id);

    const recipe = await createRecipe({ homeId: home.id, createdById: user.id });
    const item = await prisma.listItem.create({
      data: { listId: list.id, text: "Onions", position: 0 },
    });
    await prisma.listItemSource.create({ data: { itemId: item.id, recipeId: recipe.id } });

    const after = await getHomeStorage(home.id);

    // Neither carries a homeId — both are reached through the list, which does — so a
    // query that followed the columns rather than the relations would miss them.
    expect(after.kinds.lists).toBeGreaterThan(before.kinds.lists);
  });

  it("never counts another household's rows", async () => {
    const theirs = await homeWithOwner();
    await createRecipe({ homeId: theirs.home.id, createdById: theirs.user.id });
    await prisma.recipe.updateMany({
      where: { homeId: theirs.home.id },
      data: { photoId: (await storedPhoto(theirs.home.id)).id },
    });

    const { home } = await homeWithOwner();
    const mine = await getHomeStorage(home.id);

    expect(mine.kinds.recipes).toBe(0);
    expect(mine.total).toBeLessThan(2_000);
  });
});

describe("the installation's storage", () => {
  it("is every home's own figure, added up", async () => {
    const first = await homeWithOwner();
    const second = await homeWithOwner();
    await joinHome({ userId: first.user.id, homeId: second.home.id, role: "USER" });

    await createRecipe({ homeId: first.home.id, createdById: first.user.id });
    await prisma.recipe.updateMany({
      where: { homeId: first.home.id },
      data: { photoId: (await storedPhoto(first.home.id)).id },
    });
    await createList({ homeId: second.home.id, createdById: second.user.id });

    const [all, one, two] = await Promise.all([
      getInstallationStorage(),
      getHomeStorage(first.home.id),
      getHomeStorage(second.home.id),
    ]);

    expect(all.total).toBe(one.total + two.total);
    expect(all.kinds.recipes).toBe(one.kinds.recipes + two.kinds.recipes);

    const share = (id: string) => all.homes.find((home) => home.id === id);
    expect(share(first.home.id)?.bytes).toBe(one.total);
    expect(share(second.home.id)?.bytes).toBe(two.total);
  });

  it("lists the homes largest first, carrying the colour each is known by", async () => {
    const small = await homeWithOwner();
    const large = await homeWithOwner();
    await prisma.home.update({ where: { id: large.home.id }, data: { theme: "PLUM" } });
    await storedPhoto(large.home.id);

    const all = await getInstallationStorage();
    const names = all.homes.map((home) => home.id);

    expect(names.indexOf(large.home.id)).toBeLessThan(names.indexOf(small.home.id));
    expect(all.homes.find((home) => home.id === large.home.id)?.theme).toBe("PLUM");
  });

  it("still names a home with nothing in it", async () => {
    // It is drawn as a slice too thin to see rather than left out: a list of homes that
    // silently drops the empty ones is a list somebody will read as "this home is gone".
    const { home } = await homeWithOwner();

    const all = await getInstallationStorage();

    expect(all.homes.map((one) => one.id)).toContain(home.id);
  });
});
