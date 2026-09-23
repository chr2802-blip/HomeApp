/**
 * Shrinking a picture in the browser, before any of it is sent.
 *
 * A photo taken on a phone is several thousand pixels across and several megabytes
 * heavy. Nothing in this app ever shows one at that size, so uploading it would be
 * spending a household's mobile data, and the server's time, on detail that is thrown
 * away the moment it arrives. Instead the picture is decoded and redrawn here, and only
 * the redrawn version travels: a full size bounded by `MAX_EDGE` for a page that shows
 * one picture, and a thumbnail bounded by `THUMB_EDGE` for a page that shows twenty.
 *
 * This runs in the browser and nowhere else — it needs a canvas. The server does not
 * trust the result: `lib/photo-file.ts` measures whatever actually arrives.
 */

import type { HomeLanguage } from "@prisma/client";
import { PHOTOS } from "./copy/photos";
import { sayIn, type Say } from "./copy/say";

/** Longest edge of the stored picture. Wide enough to fill a phone screen twice over. */
export const MAX_EDGE = 1600;

/**
 * Longest edge of the thumbnail, sized for a card rather than a page. Wider than the
 * widest card the layout produces, so a cover is never stretched past what it holds.
 */
export const THUMB_EDGE = 600;

const QUALITY = 0.82;
const THUMB_QUALITY = 0.72;

/**
 * Everything the browser will decode goes far below this; it is here so that picking a
 * video, or a file that merely claims to be a picture, fails at once rather than after
 * a minute of trying to decode it.
 */
const MAX_SOURCE_BYTES = 60_000_000;

export type PreparedPhoto = { full: Blob; thumb: Blob; width: number; height: number };

/** Thrown with wording meant for the person who picked the file. */
export class PhotoError extends Error {}

export async function preparePhoto(file: File, language: HomeLanguage): Promise<PreparedPhoto> {
  const say = sayIn(language);
  if (!file.type.startsWith("image/")) throw new PhotoError(say(PHOTOS.notAnImage));
  if (file.size > MAX_SOURCE_BYTES) throw new PhotoError(say(PHOTOS.tooLargeToRead));

  const source = await decode(file, say);

  try {
    const full = await draw(source, MAX_EDGE, QUALITY, say);
    const thumb = await draw(source, THUMB_EDGE, THUMB_QUALITY, say);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    if ("close" in source) source.close();
  }
}

type Source = (ImageBitmap | HTMLImageElement) & { width: number; height: number };

/**
 * Decodes the file, with the camera's rotation already applied.
 *
 * A phone held sideways records an upright picture plus an EXIF note saying which way
 * up it is. Drawing the raw pixels onto a canvas loses the note, and the picture is
 * stored on its side — which is exactly the sort of thing that is never noticed until
 * the photos are of somebody's kitchen. `imageOrientation: "from-image"` asks the
 * decoder to apply it; the `<img>` fallback, for browsers without `createImageBitmap`,
 * applies it as part of rendering.
 */
async function decode(file: File, say: Say): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // A format the bitmap decoder will not take — an <img> may still manage it.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const element = new Image();
    element.src = url;
    await element.decode();
    return element;
  } catch {
    throw new PhotoError(say(PHOTOS.unreadableTryJpeg));
  } finally {
    // Safe here: the bitmap is decoded and held in memory, so drawing it later no
    // longer needs the URL.
    URL.revokeObjectURL(url);
  }
}

/**
 * Redraws the picture no larger than `edge` on its longest side, and never larger than
 * it already is — enlarging a small picture would cost bytes and add nothing.
 *
 * Always written out as JPEG: every browser's canvas can produce one, which WebP's
 * cannot be relied on for, and a photograph is what this is nearly always for. The
 * white background matters for the exception — a PNG with transparent corners drawn
 * onto an empty canvas turns those corners black.
 */
async function draw(source: Source, edge: number, quality: number, say: Say) {
  const width = source.width;
  const height = source.height;
  if (!width || !height) throw new PhotoError(say(PHOTOS.unreadable));

  const scale = Math.min(1, edge / Math.max(width, height));
  const target = {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError(say(PHOTOS.cannotResize));

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, target.width, target.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, target.width, target.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new PhotoError(say(PHOTOS.couldNotResize));

  return { blob, ...target };
}
