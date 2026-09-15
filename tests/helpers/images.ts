import { deflateSync } from "node:zlib";

/**
 * Pictures built byte by byte, so the suites never depend on a binary fixture nobody
 * can read in a diff.
 *
 * `pngBytes` produces a real PNG — the browser tests hand it to a file input and the
 * app decodes it for real — while the JPEG and WebP builders write only as much of the
 * header as states the dimensions, which is all `readPhotoMeta` ever looks at.
 *
 * Imported by the Playwright suite as well as by vitest, hence no test-framework
 * imports here.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([head, body, crc]);
}

/**
 * A real PNG of the given size.
 *
 * `noisy` fills it with pseudo-random pixels instead of a flat colour, which is how a
 * picture large in bytes rather than merely in pixels is made: a flat 3000×2000 image
 * compresses to a few hundred bytes.
 */
export function pngBytes(width: number, height: number, options: { noisy?: boolean } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  // compression, filter and interlace methods are all 0, which Buffer.alloc gave us.

  const rowLength = width * 3 + 1;
  const raw = Buffer.alloc(rowLength * height);
  let seed = 1;
  for (let y = 0; y < height; y++) {
    const start = y * rowLength;
    raw[start] = 0; // filter: none
    for (let x = 0; x < width * 3; x++) {
      if (options.noisy) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        raw[start + 1 + x] = seed & 0xff;
      } else {
        raw[start + 1 + x] = (x + y) & 0xff;
      }
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A JPEG header: the start marker, one comment segment, then the frame that sizes it. */
export function jpegHeaderBytes(width: number, height: number) {
  const comment = Buffer.concat([
    Buffer.from([0xff, 0xfe, 0x00, 0x10]),
    Buffer.from("not a picture", "ascii"),
    Buffer.from([0x00]),
  ]);

  const frame = Buffer.alloc(11);
  frame.writeUInt16BE(0xffc0, 0);
  frame.writeUInt16BE(9, 2); // segment length
  frame[4] = 8; // sample precision
  frame.writeUInt16BE(height, 5);
  frame.writeUInt16BE(width, 7);
  frame[9] = 1; // one component
  frame[10] = 0;

  return Buffer.concat([Buffer.from([0xff, 0xd8]), comment, frame]);
}

/** A lossy ("VP8 ") WebP header. */
export function webpHeaderBytes(width: number, height: number) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8 ", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  bytes.writeUInt8(0x9d, 23);
  bytes.writeUInt8(0x01, 24);
  bytes.writeUInt8(0x2a, 25);
  bytes.writeUInt16LE(width, 26);
  bytes.writeUInt16LE(height, 28);
  return bytes;
}

/** A lossless ("VP8L") WebP header, which packs its dimensions quite differently. */
export function webpLosslessBytes(width: number, height: number) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8L", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  bytes.writeUInt8(0x2f, 20);
  bytes.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 21);
  return bytes;
}

/** An extended ("VP8X") WebP header, the form used when there is an alpha channel. */
export function webpExtendedBytes(width: number, height: number) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  const write24 = (value: number, at: number) => {
    bytes[at] = value & 0xff;
    bytes[at + 1] = (value >> 8) & 0xff;
    bytes[at + 2] = (value >> 16) & 0xff;
  };
  write24(width - 1, 24);
  write24(height - 1, 27);
  return bytes;
}
