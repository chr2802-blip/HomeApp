"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { photoUrl } from "@/components/photo";
import { holdHistoryEntry } from "@/components/modal";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import {
  IDENTITY,
  distance,
  doubleTap,
  midpoint,
  pinch,
  settle,
  swipeOutcome,
  wheel,
  type Point,
  type View,
} from "@/lib/zoom";

const DOUBLE_TAP_MS = 280;
/** How far a finger moves before a press counts as a drag rather than a tap. */
const SLOP = 8;

type Gesture =
  | { kind: "none" }
  | { kind: "pending"; start: Point; at: number }
  | { kind: "swipe"; axis: "x" | "y"; start: Point; last: Point; lastAt: number; velocity: number }
  | { kind: "pan"; start: Point; view: View }
  | { kind: "pinch"; view: View; mid: Point; distance: number };

/**
 * Pictures shown across the whole screen, as a phone's photo app does: swipe sideways
 * between them, pinch or double-tap to zoom, drag to look around a zoomed picture, pull
 * down (or press the ×, Escape or the back button) to close. Arrow keys and the side
 * buttons step on a computer, and the wheel zooms.
 */
export function PhotoViewer({
  photoIds,
  index: startIndex,
  alt,
  onClose,
}: {
  photoIds: string[];
  /** The picture to open on. */
  index: number;
  alt: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [view, setView] = useState<View>(IDENTITY);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  /** Off while a finger is on the glass, so the picture follows it without lag. */
  const [animate, setAnimate] = useState(true);
  const [chrome, setChrome] = useState(true);

  const frame = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>({ kind: "none" });
  const lastTap = useRef<{ at: number; point: Point } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRef = useRef(view);
  const indexRef = useRef(startIndex);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    viewRef.current = view;
    indexRef.current = index;
    onCloseRef.current = onClose;
  });
  const say = sayIn(useLanguage());

  const count = photoIds.length;
  const go = useCallback(
    (to: number) => {
      setAnimate(true);
      setView(IDENTITY);
      setOffset({ x: 0, y: 0 });
      setIndex(Math.min(count - 1, Math.max(0, to)));
    },
    [count],
  );

  useEffect(() => {
    return holdHistoryEntry(() => onCloseRef.current());
  }, []);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      else if (event.key === "ArrowRight") go(indexRef.current + 1);
      else if (event.key === "ArrowLeft") go(indexRef.current - 1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, [go]);

  // The wheel zooms; a listener of our own, since React's is passive and cannot stop the page.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = fromCentre({ x: event.clientX, y: event.clientY });
      setAnimate(false);
      setView((current) => rest(wheel(current, at, event.deltaY)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function sizes() {
    const box = frame.current?.getBoundingClientRect();
    const img = picture.current;
    const frameSize = { width: box?.width ?? window.innerWidth, height: box?.height ?? window.innerHeight };
    // The picture's drawn size at scale 1 (object-contain within the frame).
    const natural = img && img.naturalWidth ? { width: img.naturalWidth, height: img.naturalHeight } : frameSize;
    const fit = Math.min(frameSize.width / natural.width, frameSize.height / natural.height);
    return { picture: { width: natural.width * fit, height: natural.height * fit }, frame: frameSize };
  }

  function rest(next: View) {
    const { picture, frame } = sizes();
    return settle(next, picture, frame);
  }

  function fromCentre(point: Point): Point {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return point;
    return { x: point.x - (box.left + box.width / 2), y: point.y - (box.top + box.height / 2) };
  }

  function beginPinch() {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return;
    gesture.current = { kind: "pinch", view: viewRef.current, mid: fromCentre(midpoint(a, b)), distance: distance(a, b) };
    setOffset({ x: 0, y: 0 });
  }

  function onPointerDown(event: React.PointerEvent) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setAnimate(false);
    if (pointers.current.size === 2) beginPinch();
    else if (pointers.current.size === 1) {
      gesture.current = { kind: "pending", start: { x: event.clientX, y: event.clientY }, at: event.timeStamp };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    const current = gesture.current;

    if (current.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      setView(pinch(current.view, current.mid, current.distance, fromCentre(midpoint(a, b)), distance(a, b)));
      return;
    }
    if (current.kind === "pending") {
      const dx = point.x - current.start.x;
      const dy = point.y - current.start.y;
      if (Math.hypot(dx, dy) < SLOP) return;
      if (viewRef.current.scale > 1) {
        gesture.current = { kind: "pan", start: current.start, view: viewRef.current };
      } else {
        const axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        gesture.current = { kind: "swipe", axis, start: current.start, last: point, lastAt: event.timeStamp, velocity: 0 };
      }
    }
    const moving = gesture.current;
    if (moving.kind === "pan") {
      setView({ ...moving.view, x: moving.view.x + point.x - moving.start.x, y: moving.view.y + point.y - moving.start.y });
    } else if (moving.kind === "swipe") {
      const elapsed = Math.max(1, event.timeStamp - moving.lastAt);
      const step = moving.axis === "x" ? point.x - moving.last.x : point.y - moving.last.y;
      moving.velocity = 0.8 * (step / elapsed) + 0.2 * moving.velocity;
      moving.last = point;
      moving.lastAt = event.timeStamp;
      if (moving.axis === "x") {
        let dx = point.x - moving.start.x;
        // Past the first or the last picture the strip gives way only a little.
        if ((index === 0 && dx > 0) || (index === count - 1 && dx < 0)) dx /= 3;
        setOffset({ x: dx, y: 0 });
      } else {
        setOffset({ x: 0, y: Math.max(0, point.y - moving.start.y) });
      }
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    setAnimate(true);

    if (current.kind === "pinch") {
      // One finger stays down: it carries on as a pan from here.
      const left = [...pointers.current.values()][0];
      const settled = rest(viewRef.current);
      gesture.current = left && settled.scale > 1 ? { kind: "pan", start: left, view: settled } : { kind: "none" };
      setView(settled);
      return;
    }
    if (pointers.current.size > 0) return;
    gesture.current = { kind: "none" };

    if (current.kind === "pan") {
      setView(rest(viewRef.current));
    } else if (current.kind === "swipe") {
      const width = frame.current?.clientWidth ?? window.innerWidth;
      const outcome = swipeOutcome(current.axis, current.axis === "x" ? offset.x : offset.y, current.velocity, width);
      if (outcome === "close") onClose();
      else if (outcome === "next" && index < count - 1) go(index + 1);
      else if (outcome === "previous" && index > 0) go(index - 1);
      else setOffset({ x: 0, y: 0 });
    } else if (current.kind === "pending" && event.type === "pointerup") {
      tap({ x: event.clientX, y: event.clientY }, event.timeStamp);
    }
  }

  function tap(point: Point, at: number) {
    const previous = lastTap.current;
    if (previous && at - previous.at < DOUBLE_TAP_MS && distance(previous.point, point) < 40) {
      lastTap.current = null;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      const { picture, frame } = sizes();
      setView(doubleTap(viewRef.current, fromCentre(point), picture, frame));
      return;
    }
    lastTap.current = { at, point };
    // A single tap shows or hides the buttons, once it is clear no second tap is coming.
    tapTimer.current = setTimeout(() => setChrome((shown) => !shown), DOUBLE_TAP_MS);
  }

  if (typeof document === "undefined") return null;
  const pull = Math.min(1, offset.y / 300);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[60] select-none">
      <div
        aria-hidden="true"
        className="animate-backdrop-in absolute inset-0 bg-black"
        style={{ opacity: 1 - pull * 0.8, transition: animate ? "opacity var(--dur-base) ease-out" : "none" }}
      />
      <div
        ref={frame}
        data-testid="photo-viewer-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-0 touch-none overflow-hidden"
      >
        <div
          className="flex h-full"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${offset.x}px), ${offset.y}px, 0) scale(${1 - pull * 0.25})`,
            transition: animate ? "transform var(--dur-page) var(--ease-arrive)" : "none",
          }}
        >
          {photoIds.map((id, i) => {
            const near = Math.abs(i - index) <= 1;
            return (
              <div key={id} className="flex h-full w-full shrink-0 items-center justify-center" aria-hidden={i !== index}>
                {near && (
                  // eslint-disable-next-line @next/next/no-img-element -- served from a session-checked route.
                  <img
                    ref={i === index ? picture : undefined}
                    data-current={i === index || undefined}
                    src={photoUrl(id)}
                    alt={count > 1 ? say(APP.photo.ofCount, { name: alt, n: String(i + 1), count: String(count) }) : alt}
                    draggable={false}
                    className="max-h-full max-w-full object-contain"
                    style={
                      i === index
                        ? {
                            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
                            transition: animate ? "transform var(--dur-base) var(--ease-arrive)" : "none",
                            willChange: "transform",
                          }
                        : undefined
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6 text-white transition-opacity ${
          chrome && pull === 0 ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="px-2 text-sm font-medium tabular-nums">{count > 1 ? `${index + 1} / ${count}` : ""}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={say(APP.photo.close)}
          className="press-icon pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {count > 1 && chrome && (
        <>
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={say(APP.photo.previous)}
              className="press-icon absolute top-1/2 left-3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 sm:flex"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {index < count - 1 && (
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={say(APP.photo.next)}
              className="press-icon absolute top-1/2 right-3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 sm:flex"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex justify-center gap-1.5">
            {photoIds.map((id, i) => (
              <span key={id} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
