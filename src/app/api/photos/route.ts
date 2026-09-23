import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MAX_PHOTO_BYTES, MAX_THUMB_BYTES } from "@/lib/photo-file";
import { storePhoto, sweepUnclaimedPhotos } from "@/lib/photos";
import { PHOTOS } from "@/lib/copy/photos";
import { sayIn } from "@/lib/copy/say";
import { DEFAULT_LANGUAGE } from "@/lib/language";

export const dynamic = "force-dynamic";

/**
 * Takes a picture the browser has already downscaled and files it under the caller's
 * home, answering with its id.
 *
 * Uploading here rather than through the form action it belongs to is what lets the
 * picture appear the instant it is chosen, and keeps the action's payload down to one
 * id whatever the picture weighs. What it costs is the possibility of an upload nobody
 * finishes — see `sweepUnclaimedPhotos`, which clears those.
 *
 * The session cookie is `SameSite=Lax`, so another site's form cannot post here as a
 * signed-in member: the browser will not send the cookie, and an unauthenticated
 * request is refused below.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const say = sayIn(user?.homeLanguage ?? DEFAULT_LANGUAGE);
  if (!user?.homeId) return refuse(say(PHOTOS.signInFirst), 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse(say(PHOTOS.uploadUnreadable), 400);
  }

  const full = await readPart(form.get("photo"), MAX_PHOTO_BYTES);
  const thumb = await readPart(form.get("thumb"), MAX_THUMB_BYTES);
  if (!full || !thumb) return refuse(say(PHOTOS.uploadWithoutImage), 400);

  const stored = await storePhoto(user.homeId, full, thumb, user.homeLanguage);
  if (!stored.ok) return refuse(stored.error, 400);

  // After the picture is safely stored, never before: a sweep that failed must not
  // cost the person the upload they just made.
  await sweepUnclaimedPhotos(user.homeId).catch(() => {});

  return NextResponse.json({ id: stored.id }, { headers: { "cache-control": "no-store" } });
}

/**
 * Reads one part of the upload, refusing an oversized one before it is held in memory.
 * `checkPhotoBytes` measures it properly afterwards; this only keeps the obviously
 * wrong out of the heap.
 */
async function readPart(part: FormDataEntryValue | null, maxBytes: number) {
  if (!(part instanceof File) || part.size === 0 || part.size > maxBytes) return null;
  return new Uint8Array(await part.arrayBuffer());
}

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
