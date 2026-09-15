import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { MAX_PHOTO_EDGE } from "@/lib/photo-file";
import { readPhotoChoice, storePhoto, sweepUnclaimedPhotos } from "@/lib/photos";
import { POST as uploadPhoto } from "@/app/api/photos/route";
import { GET as servePhoto } from "@/app/api/photos/[id]/route";
import { createList, updateList, deleteList } from "@/app/actions/lists";
import { createRecipe } from "@/app/actions/recipes";
import { createTask, deleteTask } from "@/app/actions/tasks";
import { updateHome } from "@/app/actions/admin";
import { pngBytes } from "../helpers/images";
import {
  createHome,
  createHomeWithMembers,
  createPhoto,
  createRecipeCategory,
  createTask as seedTask,
  createUser,
  formData,
  signIn,
  signOut,
  submit,
} from "../helpers/factories";
import { captureRedirect } from "../helpers/expect";

const HOUR = 60 * 60 * 1000;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR);

/** The two sizes a real upload arrives as. */
const upload = (full = pngBytes(1600, 1200), thumb = pngBytes(400, 300)) =>
  ({ full, thumb }) as const;

function uploadRequest(full: Uint8Array, thumb: Uint8Array) {
  const body = new FormData();
  body.set("photo", new File([Uint8Array.from(full)], "photo.png", { type: "image/png" }));
  body.set("thumb", new File([Uint8Array.from(thumb)], "thumb.png", { type: "image/png" }));
  return new Request("http://localhost/api/photos", { method: "POST", body });
}

const serve = (id: string, size?: "thumb") =>
  servePhoto(new Request(`http://localhost/api/photos/${id}${size ? `?size=${size}` : ""}`), {
    params: Promise.resolve({ id }),
  });

describe("storePhoto", () => {
  it("stores both sizes, measured from the bytes rather than the request", async () => {
    const home = await createHome();
    const { full, thumb } = upload();

    const stored = await storePhoto(home.id, full, thumb);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;

    const photo = await prisma.photo.findUniqueOrThrow({ where: { id: stored.id } });
    expect(photo).toMatchObject({
      homeId: home.id,
      contentType: "image/png",
      width: 1600,
      height: 1200,
      thumbWidth: 400,
      thumbHeight: 300,
    });
    expect(Buffer.from(photo.bytes).equals(Buffer.from(full))).toBe(true);
  });

  it("refuses a file that is not a picture", async () => {
    const home = await createHome();
    const notAPicture = Buffer.from("<script>alert(1)</script>", "ascii");

    const stored = await storePhoto(home.id, notAPicture, pngBytes(40, 30));

    expect(stored).toEqual({ ok: false, error: "That file is not a JPEG, PNG or WebP image." });
    expect(await prisma.photo.count()).toBe(0);
  });

  /*
   * The browser downscales before sending; this is what holds when the browser is not
   * the caller. Nothing is written when either size is refused.
   */
  it("refuses one past the longest edge it stores", async () => {
    const home = await createHome();

    const stored = await storePhoto(home.id, pngBytes(MAX_PHOTO_EDGE + 1, 10), pngBytes(40, 30));

    expect(stored.ok).toBe(false);
    expect(await prisma.photo.count()).toBe(0);
  });

  it("refuses an oversized thumbnail even when the full size passes", async () => {
    const home = await createHome();

    const stored = await storePhoto(home.id, pngBytes(800, 600), pngBytes(MAX_PHOTO_EDGE + 1, 10));

    expect(stored.ok).toBe(false);
    expect(await prisma.photo.count()).toBe(0);
  });
});

describe("uploading", () => {
  it("refuses an anonymous caller", async () => {
    signOut();
    const { full, thumb } = upload();

    const response = await uploadPhoto(uploadRequest(full, thumb));

    expect(response.status).toBe(401);
    expect(await prisma.photo.count()).toBe(0);
  });

  it("files a member's upload under their own home", async () => {
    const { home, member } = await createHomeWithMembers();
    await signIn(member);
    const { full, thumb } = upload();

    const response = await uploadPhoto(uploadRequest(full, thumb));

    expect(response.status).toBe(200);
    const { id } = await response.json();
    expect(await prisma.photo.findUniqueOrThrow({ where: { id } })).toMatchObject({
      homeId: home.id,
    });
  });

  it("reports why a bad file was refused", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const response = await uploadPhoto(
      uploadRequest(Buffer.from("not a picture", "ascii"), pngBytes(40, 30)),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "That file is not a JPEG, PNG or WebP image.",
    });
  });

  it("refuses an upload that carries no image", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    const body = new FormData();
    body.set("photo", "just a string");
    const response = await uploadPhoto(
      new Request("http://localhost/api/photos", { method: "POST", body }),
    );

    expect(response.status).toBe(400);
  });
});

describe("serving", () => {
  it("gives a member of the home the picture", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(member);

    const response = await serve(photo.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(Buffer.from(await response.arrayBuffer()).equals(Buffer.from(photo.bytes))).toBe(true);
  });

  it("gives the thumbnail when asked for one", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(member);

    const body = Buffer.from(await (await serve(photo.id, "thumb")).arrayBuffer());

    expect(body.equals(Buffer.from(photo.thumbBytes))).toBe(true);
    expect(body.equals(Buffer.from(photo.bytes))).toBe(false);
  });

  /*
   * Not found rather than refused: the same answer as an id that never existed is the
   * only answer that tells an outsider nothing about what another household keeps.
   */
  it("does not find another home's picture", async () => {
    const { member } = await createHomeWithMembers();
    const neighbour = await createHome();
    const photo = await createPhoto({ homeId: neighbour.id });
    await signIn(member);

    expect((await serve(photo.id)).status).toBe(404);
  });

  it("does not find anything for an anonymous caller", async () => {
    const home = await createHome();
    const photo = await createPhoto({ homeId: home.id });
    signOut();

    expect((await serve(photo.id)).status).toBe(404);
  });

  it("does not find anything for a super admin with no home chosen", async () => {
    const home = await createHome();
    const photo = await createPhoto({ homeId: home.id });
    const wanderer = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(wanderer);

    expect((await serve(photo.id)).status).toBe(404);
  });
});

describe("attaching a picture", () => {
  it("puts one on a new list", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(member);

    await captureRedirect(() =>
      submit(createList, { title: "Shopping", photoId: photo.id }),
    );

    const list = await prisma.list.findFirstOrThrow();
    expect(list.photoId).toBe(photo.id);
  });

  it("puts one on a new task and a new recipe", async () => {
    const { home, member } = await createHomeWithMembers();
    const category = await createRecipeCategory({ homeId: home.id });
    const [taskPhoto, recipePhoto] = await Promise.all([
      createPhoto({ homeId: home.id }),
      createPhoto({ homeId: home.id }),
    ]);
    await signIn(member);

    expect(
      await submit(createTask, { title: "Change the filter", intervalDays: "30", photoId: taskPhoto.id }),
    ).toEqual({ ok: true });
    await captureRedirect(() =>
      submit(createRecipe, {
        title: "Pancakes",
        categoryId: category.id,
        photoId: recipePhoto.id,
      }),
    );

    expect((await prisma.task.findFirstOrThrow()).photoId).toBe(taskPhoto.id);
    expect((await prisma.recipe.findFirstOrThrow()).photoId).toBe(recipePhoto.id);
  });

  it("puts one on the home itself", async () => {
    const { home, admin } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(admin);

    const result = await submit(updateHome, {
      homeId: home.id,
      name: home.name,
      photoId: photo.id,
    });

    expect(result).toEqual({ ok: true });
    expect((await prisma.home.findUniqueOrThrow({ where: { id: home.id } })).photoId).toBe(
      photo.id,
    );
  });

  /*
   * The id arrives in a form, and a form can say anything. It is looked up through
   * homeDb, so another household's picture is simply not found.
   */
  it("refuses another home's picture", async () => {
    const { member } = await createHomeWithMembers();
    const neighbour = await createHome();
    const theirs = await createPhoto({ homeId: neighbour.id });
    await signIn(member);

    const result = await submit(createList, { title: "Shopping", photoId: theirs.id });

    expect(result).toEqual({
      ok: false,
      error: "That picture is no longer available — add it again.",
    });
    expect(await prisma.list.count()).toBe(0);
  });

  it("treats a form with no picture field as leaving the picture alone", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(member);

    expect(await readPhotoChoice(formData({}), home.id)).toEqual({
      ok: true,
      photoId: undefined,
    });
    expect(await readPhotoChoice(formData({ photoId: "" }), home.id)).toEqual({
      ok: true,
      photoId: null,
    });
    expect(await readPhotoChoice(formData({ photoId: photo.id }), home.id)).toEqual({
      ok: true,
      photoId: photo.id,
    });
  });
});

describe("replacing and removing", () => {
  it("deletes the picture a list no longer uses", async () => {
    const { home, member } = await createHomeWithMembers();
    const [first, second] = await Promise.all([
      createPhoto({ homeId: home.id }),
      createPhoto({ homeId: home.id }),
    ]);
    await signIn(member);

    await captureRedirect(() => submit(createList, { title: "Shopping", photoId: first.id }));
    const list = await prisma.list.findFirstOrThrow();

    await submit(updateList, { listId: list.id, title: "Shopping", photoId: second.id });

    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).photoId).toBe(
      second.id,
    );
    expect(await prisma.photo.findUnique({ where: { id: first.id } })).toBeNull();
  });

  it("deletes the picture when it is taken off", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(member);

    await captureRedirect(() => submit(createList, { title: "Shopping", photoId: photo.id }));
    const list = await prisma.list.findFirstOrThrow();

    await submit(updateList, { listId: list.id, title: "Shopping", photoId: "" });

    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).photoId).toBeNull();
    expect(await prisma.photo.findUnique({ where: { id: photo.id } })).toBeNull();
  });

  it("keeps the picture when the form saves without changing it", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(member);

    await captureRedirect(() => submit(createList, { title: "Shopping", photoId: photo.id }));
    const list = await prisma.list.findFirstOrThrow();

    await submit(updateList, { listId: list.id, title: "Groceries", photoId: photo.id });

    expect((await prisma.list.findUniqueOrThrow({ where: { id: list.id } })).photoId).toBe(
      photo.id,
    );
    expect(await prisma.photo.findUnique({ where: { id: photo.id } })).not.toBeNull();
  });

  it("deletes the picture along with the list it belonged to", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    await signIn(member);

    await captureRedirect(() => submit(createList, { title: "Shopping", photoId: photo.id }));
    const list = await prisma.list.findFirstOrThrow();

    await captureRedirect(() => deleteList(formData({ listId: list.id })));

    expect(await prisma.photo.findUnique({ where: { id: photo.id } })).toBeNull();
  });

  it("deletes the picture along with the task it belonged to", async () => {
    const { home, member } = await createHomeWithMembers();
    const photo = await createPhoto({ homeId: home.id });
    const task = await seedTask({ homeId: home.id, createdById: member.id });
    await prisma.task.update({ where: { id: task.id }, data: { photoId: photo.id } });
    await signIn(member);

    await deleteTask(formData({ taskId: task.id }));

    expect(await prisma.photo.findUnique({ where: { id: photo.id } })).toBeNull();
  });

  it("takes a home's pictures with it when the home goes", async () => {
    const home = await createHome();
    const photo = await createPhoto({ homeId: home.id });
    await prisma.home.update({ where: { id: home.id }, data: { photoId: photo.id } });

    await prisma.home.delete({ where: { id: home.id } });

    expect(await prisma.photo.count()).toBe(0);
  });
});

describe("sweeping up uploads nobody finished", () => {
  it("removes an old picture that nothing points at", async () => {
    const home = await createHome();
    const stray = await createPhoto({ homeId: home.id, createdAt: hoursAgo(3) });

    expect(await sweepUnclaimedPhotos(home.id)).toBe(1);
    expect(await prisma.photo.findUnique({ where: { id: stray.id } })).toBeNull();
  });

  it("leaves a recent one alone — its form may still be open", async () => {
    const home = await createHome();
    const fresh = await createPhoto({ homeId: home.id });

    expect(await sweepUnclaimedPhotos(home.id)).toBe(0);
    expect(await prisma.photo.findUnique({ where: { id: fresh.id } })).not.toBeNull();
  });

  it("leaves alone anything a home, list, task or recipe is using", async () => {
    const { home, member } = await createHomeWithMembers();
    const category = await createRecipeCategory({ homeId: home.id });
    const old = { homeId: home.id, createdAt: hoursAgo(3) };

    const [onHome, onList, onTask, onRecipe] = await Promise.all([
      createPhoto(old),
      createPhoto(old),
      createPhoto(old),
      createPhoto(old),
    ]);

    await prisma.home.update({ where: { id: home.id }, data: { photoId: onHome.id } });
    await prisma.list.create({
      data: { homeId: home.id, createdById: member.id, title: "Shopping", photoId: onList.id },
    });
    await prisma.task.create({
      data: {
        homeId: home.id,
        createdById: member.id,
        title: "Filter",
        intervalDays: 30,
        nextDueAt: new Date(),
        photoId: onTask.id,
      },
    });
    await prisma.recipe.create({
      data: {
        homeId: home.id,
        createdById: member.id,
        categoryId: category.id,
        title: "Pancakes",
        photoId: onRecipe.id,
      },
    });

    expect(await sweepUnclaimedPhotos(home.id)).toBe(0);
    expect(await prisma.photo.count()).toBe(4);
  });

  it("never reaches into another home", async () => {
    const mine = await createHome();
    const neighbour = await createHome();
    const theirs = await createPhoto({ homeId: neighbour.id, createdAt: hoursAgo(3) });

    expect(await sweepUnclaimedPhotos(mine.id)).toBe(0);
    expect(await prisma.photo.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  it("runs as part of an upload, so strays never need a schedule of their own", async () => {
    const { home, member } = await createHomeWithMembers();
    const stray = await createPhoto({ homeId: home.id, createdAt: hoursAgo(3) });
    await signIn(member);

    const { full, thumb } = upload();
    const response = await uploadPhoto(uploadRequest(full, thumb));

    expect(response.status).toBe(200);
    expect(await prisma.photo.findUnique({ where: { id: stray.id } })).toBeNull();
    expect(await prisma.photo.count()).toBe(1);
  });
});
