/**
 * The arithmetic behind zooming a picture with the fingers, kept apart from the DOM so it
 * can be tested. A picture is drawn centred in its frame and moved with
 * `translate(x, y) scale(scale)` about its centre; points are measured from that centre.
 */

export type Point = { x: number; y: number };
export type View = { scale: number; x: number; y: number };
export type Size = { width: number; height: number };

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;
/** How far a double tap zooms in. */
export const DOUBLE_TAP_SCALE = 2.5;

export const IDENTITY: View = { scale: 1, x: 0, y: 0 };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * The view while two fingers pinch: the picture grows by how far the fingers spread, and
 * the spot that was under them stays under them, even as they move. Beyond the limits it
 * gives way only a little (and springs back on release, see `settle`).
 */
export function pinch(start: View, startMid: Point, startDistance: number, mid: Point, now: number): View {
  const wanted = start.scale * (now / Math.max(startDistance, 1));
  const scale = rubber(wanted, MIN_SCALE * 0.6, MAX_SCALE * 1.3);
  // The picture's own point under the fingers when the pinch began…
  const anchor = { x: (startMid.x - start.x) / start.scale, y: (startMid.y - start.y) / start.scale };
  // …is kept under where the fingers are now.
  return { scale, x: mid.x - anchor.x * scale, y: mid.y - anchor.y * scale };
}

function rubber(value: number, low: number, high: number) {
  if (value < MIN_SCALE) return Math.max(low, MIN_SCALE - (MIN_SCALE - value) / 2);
  if (value > MAX_SCALE) return Math.min(high, MAX_SCALE + (value - MAX_SCALE) / 2);
  return value;
}

/**
 * Where a view comes to rest: the scale within its limits, and the picture moved back so
 * it never leaves an edge of the frame uncovered when it is bigger than the frame (and
 * stays centred along a side where it is smaller). `picture` is its size at scale 1.
 */
export function settle(view: View, picture: Size, frame: Size): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale));
  if (scale === MIN_SCALE) return IDENTITY;
  // Keep the spot at the frame's centre where it was when the scale is pulled back.
  const ratio = scale / view.scale;
  const x = view.x * ratio;
  const y = view.y * ratio;
  const reachX = Math.max(0, (picture.width * scale - frame.width) / 2);
  const reachY = Math.max(0, (picture.height * scale - frame.height) / 2);
  return { scale, x: clamp(x, -reachX, reachX), y: clamp(y, -reachY, reachY) };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** A double tap: zoom in on the spot tapped, or back out when already zoomed. */
export function doubleTap(view: View, at: Point, picture: Size, frame: Size): View {
  if (view.scale > MIN_SCALE) return IDENTITY;
  const scale = DOUBLE_TAP_SCALE;
  return settle({ scale, x: -at.x * (scale - 1), y: -at.y * (scale - 1) }, picture, frame);
}

/** A wheel or trackpad turn zooms about the pointer, the way a pinch would there. */
export function wheel(view: View, at: Point, deltaY: number): View {
  const scale = clamp(view.scale * Math.exp(-deltaY * 0.002), MIN_SCALE, MAX_SCALE);
  const anchor = { x: (at.x - view.x) / view.scale, y: (at.y - view.y) / view.scale };
  return { scale, x: at.x - anchor.x * scale, y: at.y - anchor.y * scale };
}

/**
 * What a one-finger drag on an unzoomed picture comes to when the finger lifts: the next
 * or previous picture when pulled far or fast enough sideways, away when pulled down.
 */
export function swipeOutcome(
  axis: "x" | "y",
  offset: number,
  /** Pixels per millisecond over the last part of the drag. */
  velocity: number,
  frameWidth: number,
): "next" | "previous" | "close" | "stay" {
  if (axis === "y") return offset > 120 || (offset > 40 && velocity > 0.5) ? "close" : "stay";
  const far = Math.abs(offset) > frameWidth * 0.2 || Math.abs(velocity) > 0.4;
  if (!far || Math.sign(offset) !== Math.sign(velocity || offset)) return "stay";
  return offset < 0 ? "next" : "previous";
}
