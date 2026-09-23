/**
 * What the server will accept as a picture, and how it reads one without decoding it.
 *
 * Pictures are downscaled in the browser before they are sent (see `lib/downscale.ts`),
 * which is what keeps a phone's twelve megapixel photo off the wire. That is a
 * convenience, not a guarantee: the browser is the caller, and a caller can be
 * replaced. So every upload is measured again here, from the bytes themselves rather
 * than from the `Content-Type` the request claims.
 *
 * Only the header is read. A JPEG, PNG or WebP states its own dimensions in the first
 * few dozen bytes, so the size of a picture can be checked before anything the size of
 * a picture is ever allocated — and a file that is not one of the three has nowhere to
 * state them, which is how anything else is refused.
 */

import type { HomeLanguage } from "@prisma/client";
import { PHOTOS } from "./copy/photos";
import { sayIn } from "./copy/say";

/** The form field every picture-carrying form posts its chosen picture under. */
export const PHOTO_FIELD = "photoId";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type PhotoType = (typeof PHOTO_TYPES)[number];

/**
 * Comfortably above what the browser produces at `MAX_EDGE` — a busy photograph at
 * quality 0.82 lands near 300 KB — and far below what an untouched phone photo weighs.
 * The gap is slack for a picture that compresses badly, not room for an original.
 */
export const MAX_PHOTO_BYTES = 1_200_000;
export const MAX_THUMB_BYTES = 200_000;

/**
 * Likewise a margin over the browser's target rather than a second opinion about it.
 * A client that rounds differently, or that was written before the target changed, is
 * still within this; an original never is.
 */
export const MAX_PHOTO_EDGE = 2200;

export type PhotoMeta = { contentType: PhotoType; width: number; height: number };

/** Reads the type and dimensions out of a picture's header, or null if it is not one. */
export function readPhotoMeta(bytes: Uint8Array): PhotoMeta | null {
  return readJpeg(bytes) ?? readPng(bytes) ?? readWebp(bytes);
}

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);

/**
 * JPEG carries its dimensions in a "start of frame" segment, which sits an unknown
 * distance in: the segments before it hold the thumbnail, the colour profile and
 * whatever else the camera had to say. So the segment chain is walked rather than read
 * at a fixed offset.
 */
function readJpeg(bytes: Uint8Array): PhotoMeta | null {
  if (!startsWith(bytes, [0xff, 0xd8])) return null;

  const data = view(bytes);
  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1];
    // Padding between segments, and the standalone markers that carry no length.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    // Compressed data begins; there is no frame header to find after this point.
    if (marker === 0xda) return null;

    const length = data.getUint16(offset + 2);
    if (length < 2) return null;

    // C0–CF are frame headers, except C4 (Huffman tables), C8 and CC, which are not.
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrame) {
      if (offset + 9 > bytes.length) return null;
      return {
        contentType: "image/jpeg",
        height: data.getUint16(offset + 5),
        width: data.getUint16(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPng(bytes: Uint8Array): PhotoMeta | null {
  // The header chunk is fixed: signature, chunk length, "IHDR", width, height.
  if (!startsWith(bytes, PNG_SIGNATURE) || bytes.length < 24) return null;

  const data = view(bytes);
  if (data.getUint32(12) !== 0x49484452) return null;

  return { contentType: "image/png", width: data.getUint32(16), height: data.getUint32(20) };
}

/**
 * WebP has three encodings and each states its size differently — lossy, lossless, and
 * the extended form that wraps either one when there is an alpha channel or metadata
 * to carry. All three sit inside a RIFF container whose first chunk says which it is.
 */
function readWebp(bytes: Uint8Array): PhotoMeta | null {
  if (bytes.length < 30) return null;
  if (!startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return null; // "RIFF"

  const data = view(bytes);
  if (data.getUint32(8) !== 0x57454250) return null; // "WEBP"

  const format = data.getUint32(12);
  const webp = (width: number, height: number): PhotoMeta => ({
    contentType: "image/webp",
    width,
    height,
  });

  // "VP8 " — lossy. Dimensions are 14 bits each, after the start code.
  if (format === 0x56503820) {
    return webp(data.getUint16(26, true) & 0x3fff, data.getUint16(28, true) & 0x3fff);
  }

  // "VP8L" — lossless. Width and height are 14 bits each, packed into four bytes.
  if (format === 0x5650384c) {
    const packed = data.getUint32(21, true);
    return webp((packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1);
  }

  // "VP8X" — extended. Dimensions are 24 bits each, stored one less than they are.
  if (format === 0x56503858) {
    const at = (index: number) => bytes[index] | (bytes[index + 1] << 8) | (bytes[index + 2] << 16);
    return webp(at(24) + 1, at(27) + 1);
  }

  return null;
}

export type PhotoCheck = { ok: true; meta: PhotoMeta } | { ok: false; error: string };

/** Measures one of the two sizes an upload arrives as, refusing in the household's own words. */
export function checkPhotoBytes(bytes: Uint8Array, maxBytes: number, language: HomeLanguage): PhotoCheck {
  const say = sayIn(language);
  if (bytes.length === 0) return { ok: false, error: say(PHOTOS.empty) };
  if (bytes.length > maxBytes) return { ok: false, error: say(PHOTOS.tooLargeToStore) };

  const meta = readPhotoMeta(bytes);
  if (!meta) return { ok: false, error: say(PHOTOS.wrongFormat) };

  if (meta.width < 1 || meta.height < 1) return { ok: false, error: say(PHOTOS.wrongFormat) };
  if (meta.width > MAX_PHOTO_EDGE || meta.height > MAX_PHOTO_EDGE) {
    return { ok: false, error: say(PHOTOS.tooManyPixels) };
  }

  return { ok: true, meta };
}
