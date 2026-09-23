import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTO_EDGE,
  checkPhotoBytes,
  readPhotoMeta,
} from "@/lib/photo-file";
import {
  jpegHeaderBytes,
  pngBytes,
  webpExtendedBytes,
  webpHeaderBytes,
  webpLosslessBytes,
} from "../helpers/images";

describe("readPhotoMeta", () => {
  it("reads a PNG's size", () => {
    expect(readPhotoMeta(pngBytes(64, 48))).toEqual({
      contentType: "image/png",
      width: 64,
      height: 48,
    });
  });

  it("reads a JPEG's size past the segments in front of the frame", () => {
    expect(readPhotoMeta(jpegHeaderBytes(1600, 1200))).toEqual({
      contentType: "image/jpeg",
      width: 1600,
      height: 1200,
    });
  });

  it("reads all three WebP encodings", () => {
    for (const bytes of [
      webpHeaderBytes(800, 600),
      webpLosslessBytes(800, 600),
      webpExtendedBytes(800, 600),
    ]) {
      expect(readPhotoMeta(bytes)).toEqual({
        contentType: "image/webp",
        width: 800,
        height: 600,
      });
    }
  });

  it("refuses anything that is not one of the three", () => {
    expect(readPhotoMeta(Buffer.from("GIF89a and then some pixels", "ascii"))).toBeNull();
    expect(readPhotoMeta(Buffer.from("%PDF-1.7", "ascii"))).toBeNull();
    expect(readPhotoMeta(Buffer.alloc(0))).toBeNull();
  });

  /*
   * The point of reading the header rather than trusting the request: a caller can put
   * whatever it likes in Content-Type, and the only thing that settles what a file is
   * is the file.
   */
  it("refuses a JPEG that stops before its frame header", () => {
    expect(readPhotoMeta(Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x10]))).toBeNull();
  });

  it("refuses a PNG signature with no header chunk behind it", () => {
    const truncated = pngBytes(10, 10).subarray(0, 16);
    expect(readPhotoMeta(truncated)).toBeNull();
  });
});

describe("checkPhotoBytes", () => {
  it("accepts a picture inside both limits", () => {
    const result = checkPhotoBytes(pngBytes(120, 90), MAX_PHOTO_BYTES, "EN");
    expect(result).toEqual({
      ok: true,
      meta: { contentType: "image/png", width: 120, height: 90 },
    });
  });

  it("refuses an empty upload", () => {
    expect(checkPhotoBytes(Buffer.alloc(0), MAX_PHOTO_BYTES, "EN")).toEqual({
      ok: false,
      error: "That image is empty.",
    });
  });

  it("refuses in the household's own language", () => {
    expect(checkPhotoBytes(Buffer.from("just some text", "ascii"), MAX_PHOTO_BYTES, "DA")).toEqual({
      ok: false,
      error: "Filen er hverken et JPEG-, PNG- eller WebP-billede.",
    });
  });

  it("refuses one heavier than the limit", () => {
    const result = checkPhotoBytes(pngBytes(200, 200, { noisy: true }), 500, "EN");
    expect(result.ok).toBe(false);
  });

  /*
   * The browser shrinks pictures before sending them, which is what keeps a phone
   * photo off the wire. This is the check that holds when the browser is not the one
   * calling.
   */
  it("refuses one larger than the longest edge stored", () => {
    const tooBig = pngBytes(MAX_PHOTO_EDGE + 1, 10);
    expect(checkPhotoBytes(tooBig, MAX_PHOTO_BYTES, "EN")).toEqual({
      ok: false,
      error: "That image is larger than this app stores — scale it down first.",
    });
  });

  it("accepts one exactly on the edge", () => {
    expect(checkPhotoBytes(pngBytes(MAX_PHOTO_EDGE, 10), MAX_PHOTO_BYTES, "EN").ok).toBe(true);
  });

  it("refuses a file that is not a picture at all", () => {
    expect(checkPhotoBytes(Buffer.from("just some text", "ascii"), MAX_PHOTO_BYTES, "EN")).toEqual({
      ok: false,
      error: "That file is not a JPEG, PNG or WebP image.",
    });
  });
});
