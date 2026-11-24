import { beforeEach, describe, expect, it } from "vitest";
import { lockScroll } from "@/lib/scroll-lock";

describe("lockScroll", () => {
  beforeEach(() => {
    (globalThis as { document?: unknown }).document = { body: { style: { overflow: "" } } };
  });
  const overflow = () => (globalThis as unknown as { document: { body: { style: { overflow: string } } } }).document.body.style.overflow;

  it("gives scrolling back whichever holder lets go last", () => {
    const first = lockScroll();
    const second = lockScroll();
    expect(overflow()).toBe("hidden");
    first(); // the sheet that opened first closes first — the order that used to stick
    expect(overflow()).toBe("hidden");
    second();
    expect(overflow()).toBe("");
  });

  it("does not count a release twice", () => {
    const first = lockScroll();
    const second = lockScroll();
    first();
    first();
    expect(overflow()).toBe("hidden");
    second();
    expect(overflow()).toBe("");
  });
});
