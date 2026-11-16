import { describe, expect, it } from "vitest";
import { DOUBLE_TAP_SCALE, IDENTITY, MAX_SCALE, distance, doubleTap, midpoint, pinch, settle, swipeOutcome, wheel } from "@/lib/zoom";

const frame = { width: 400, height: 800 };
const picture = { width: 400, height: 300 };

describe("pinch", () => {
  it("grows by how far the fingers spread, keeping the spot under them in place", () => {
    const mid = { x: 100, y: 50 };
    const view = pinch(IDENTITY, mid, 100, mid, 200);
    expect(view.scale).toBe(2);
    // The picture's point (100, 50) is still drawn at (100, 50).
    expect({ x: view.x + 100 * view.scale, y: view.y + 50 * view.scale }).toEqual(mid);
  });

  it("follows the fingers as they move together", () => {
    const view = pinch(IDENTITY, { x: 0, y: 0 }, 100, { x: 30, y: -20 }, 100);
    expect(view).toEqual({ scale: 1, x: 30, y: -20 });
  });

  it("gives way only a little beyond the limits", () => {
    expect(pinch(IDENTITY, { x: 0, y: 0 }, 100, { x: 0, y: 0 }, 1000).scale).toBeLessThanOrEqual(MAX_SCALE * 1.3);
    expect(pinch(IDENTITY, { x: 0, y: 0 }, 100, { x: 0, y: 0 }, 10).scale).toBeGreaterThanOrEqual(0.6);
  });
});

describe("settle", () => {
  it("springs back to the whole picture below scale 1", () => {
    expect(settle({ scale: 0.7, x: 40, y: 10 }, picture, frame)).toEqual(IDENTITY);
  });

  it("pulls the scale back within the limit", () => {
    expect(settle({ scale: 5, x: 0, y: 0 }, picture, frame).scale).toBe(MAX_SCALE);
  });

  it("never leaves an edge uncovered, and keeps a short picture centred top to bottom", () => {
    // At 2× the picture is 800×600: 200 px to spare each side, none top or bottom.
    expect(settle({ scale: 2, x: 500, y: 90 }, picture, frame)).toEqual({ scale: 2, x: 200, y: 0 });
    expect(settle({ scale: 2, x: -500, y: 0 }, picture, frame).x).toBe(-200);
  });
});

describe("doubleTap", () => {
  it("zooms in on the spot tapped, and out again", () => {
    const at = { x: 50, y: 0 };
    const zoomed = doubleTap(IDENTITY, at, picture, frame);
    expect(zoomed.scale).toBe(DOUBLE_TAP_SCALE);
    expect(zoomed.x + at.x * zoomed.scale).toBeCloseTo(at.x);
    expect(doubleTap(zoomed, at, picture, frame)).toEqual(IDENTITY);
  });
});

describe("wheel", () => {
  it("zooms in on a turn away from the reader and stays within the limits", () => {
    expect(wheel(IDENTITY, { x: 0, y: 0 }, -100).scale).toBeGreaterThan(1);
    expect(wheel(IDENTITY, { x: 0, y: 0 }, 100).scale).toBe(1);
    expect(wheel({ scale: MAX_SCALE, x: 0, y: 0 }, { x: 0, y: 0 }, -1000).scale).toBe(MAX_SCALE);
  });
});

describe("swipeOutcome", () => {
  it("turns the page when pulled far or flicked fast, and not against the flick", () => {
    expect(swipeOutcome("x", -120, 0, 400)).toBe("next");
    expect(swipeOutcome("x", 120, 0, 400)).toBe("previous");
    expect(swipeOutcome("x", -30, -0.8, 400)).toBe("next");
    expect(swipeOutcome("x", -30, 0, 400)).toBe("stay");
    expect(swipeOutcome("x", -120, 0.6, 400)).toBe("stay");
  });

  it("closes when pulled down far enough", () => {
    expect(swipeOutcome("y", 150, 0, 400)).toBe("close");
    expect(swipeOutcome("y", 60, 0.8, 400)).toBe("close");
    expect(swipeOutcome("y", 60, 0, 400)).toBe("stay");
  });
});

describe("points", () => {
  it("measures between two fingers", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual({ x: 2, y: 1 });
  });
});
