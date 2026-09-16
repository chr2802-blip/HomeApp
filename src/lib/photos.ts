import { prisma } from "./prisma";
import { homeDb } from "./home-db";
import { MAX_PHOTO_BYTES, MAX_THUMB_BYTES, PHOTO_FIELD, checkPhotoBytes } from "./photo-file";

const NOT_IN_HOME = "That picture is no longer available — add it again.";

/**
 * How long an uploaded picture is kept before it counts as abandoned.
 *
 * A picture is stored the moment it is chosen, so that the person sees it straight
 * away and the form only has to carry its id. Close the dialog instead of saving and
 * that picture belongs to nothing. An hour is far longer than anyone spends filling in
 * a form and short enough that the strays never add up.
 */
const UNCLAIMED_MS = 60 * 60 * 1000;

/** How many strays one upload clears. A bound, so an upload cannot become a long job. */
const SWEEP_LIMIT = 20;

export type PhotoResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Checks an upload and files it under a home.
 *
 * Both sizes are measured from their own bytes rather than from what the request said
 * about them — see `lib/photo-file.ts`. The home is named in the write, the way every
 * other create in the app names it: it comes from the session the caller was just
 * resolved from, and is never anything a request supplied.
 */
export async function storePhoto(
  homeId: string,
  full: Uint8Array,
  thumb: Uint8Array,
): Promise<PhotoResult> {
  const checkedFull = checkPhotoBytes(full, MAX_PHOTO_BYTES);
  if (!checkedFull.ok) return checkedFull;

  const checkedThumb = checkPhotoBytes(thumb, MAX_THUMB_BYTES);
  if (!checkedThumb.ok) return checkedThumb;

  const photo = await prisma.photo.create({
    data: {
      homeId,
      contentType: checkedFull.meta.contentType,
      width: checkedFull.meta.width,
      height: checkedFull.meta.height,
      bytes: Buffer.from(full),
      thumbWidth: checkedThumb.meta.width,
      thumbHeight: checkedThumb.meta.height,
      thumbBytes: Buffer.from(thumb),
    },
    select: { id: true },
  });

  return { ok: true, id: photo.id };
}

export type PhotoChoice =
  /** `undefined` means the form had no picture field: leave whatever is there. */
  { ok: true; photoId: string | null | undefined } | { ok: false; error: string };

/**
 * Reads the picture a form is attaching.
 *
 * The id arrives in a form, and a form can say anything, so it is looked up through
 * `homeDb`: another household's picture is simply not found, which makes the check the
 * query itself rather than a comparison somebody has to remember to write. An empty
 * field means the picture was taken off, which is different from a field that was never
 * on the form at all.
 */
export async function readPhotoChoice(formData: FormData, homeId: string): Promise<PhotoChoice> {
  const raw = formData.get(PHOTO_FIELD);
  if (raw === null) return { ok: true, photoId: undefined };

  const id = String(raw).trim();
  if (!id) return { ok: true, photoId: null };

  const photo = await homeDb(homeId).photo.findUnique({ where: { id }, select: { id: true } });
  return photo ? { ok: true, photoId: photo.id } : { ok: false, error: NOT_IN_HOME };
}

/**
 * Removes a picture nothing points at any more — the one that was replaced, or the one
 * belonging to a list or recipe being deleted.
 *
 * `deleteMany` rather than `delete`, so a picture already gone is not an error: the
 * caller wants it absent, and it is.
 */
export async function discardPhoto(homeId: string, photoId: string | null | undefined) {
  if (!photoId) return;
  await homeDb(homeId).photo.deleteMany({ where: { id: photoId } });
}

/** The replaced picture, when a form has swapped one for another or taken it off. */
export async function discardReplaced(
  homeId: string,
  previous: string | null,
  chosen: string | null | undefined,
) {
  if (chosen === undefined || previous === null || previous === chosen) return;
  await discardPhoto(homeId, previous);
}

/**
 * Clears out uploads that were never attached to anything.
 *
 * Run after a successful upload rather than on a schedule: a home that is not adding
 * pictures cannot be accumulating abandoned ones, so the work arrives exactly when
 * there is any to do, and there is no second thing to keep running. The relation
 * counts are what make "attached to nothing" a question the database can answer — the
 * pages themselves never read them.
 */
export async function sweepUnclaimedPhotos(homeId: string) {
  const db = homeDb(homeId);

  const unclaimed = await db.photo.findMany({
    where: {
      createdAt: { lt: new Date(Date.now() - UNCLAIMED_MS) },
      homes: { none: {} },
      lists: { none: {} },
      tasks: { none: {} },
      recipes: { none: {} },
      users: { none: {} },
    },
    select: { id: true },
    take: SWEEP_LIMIT,
  });
  if (unclaimed.length === 0) return 0;

  await db.photo.deleteMany({ where: { id: { in: unclaimed.map((photo) => photo.id) } } });
  return unclaimed.length;
}
