"use client";

import { startTransition, useEffect, useOptimistic, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useLanguage } from "./language-provider";
import { SECTIONS } from "./section-tabs";
import { isInTab, navItemsFor, type NavItem } from "./nav-items";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { NAV } from "@/lib/copy/nav";
import { setNavPins } from "@/app/actions/nav";
import { dropPin, PIN_FIELD, PINNABLE_TABS, type PinnableTab } from "@/lib/nav-tabs";

/**
 * The pins as the server last said, with the press just made shown at once — the tab
 * bar under the drawer changes under the thumb, not a round trip later.
 */
export function useNavPins(stored: PinnableTab[]) {
  const [pins, show] = useOptimistic(stored);
  const change = (next: PinnableTab[]) =>
    startTransition(async () => {
      show(next);
      const form = new FormData();
      for (const pin of next) form.append(PIN_FIELD, pin);
      await setNavPins(form);
    });
  return [pins, change] as const;
}

/**
 * Where the finger is decides the place, which is what a person dragging means; a drag by
 * keyboard has no finger, and falls back to the dragged row's own box.
 */
const underFinger: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 || args.pointerCoordinates ? hits : rectIntersection(args);
};

/**
 * Every tab, with the two in the tab bar first, and the controls that choose them: the
 * menu's drawer draws it with each name a way to its page, `/profile` without.
 *
 * Choosing is dragging. Every tab that may sit in the bar has a handle; dropped on one of
 * the two places it takes that place, and the tab that was there drops down among the
 * others — the place is named by where the finger let go, so nothing is replaced that
 * the person did not point at. One place dropped on the other swaps them, and a pinned
 * tab dropped on one further down trades places with it. The keyboard drags the same
 * handles (space, the arrows, space).
 */
export function NavPins({
  items,
  pins,
  onChange,
  pathname,
  onOpen,
}: {
  items: NavItem[];
  pins: PinnableTab[];
  onChange: (pins: PinnableTab[]) => void;
  /** Where the reader is, so the row for that tab can say so. */
  pathname?: string;
  /** Given, every name is a link, and this is told which one was pressed. */
  onOpen?: (href: string) => void;
}) {
  const say = sayIn(useLanguage());
  const [dragging, setDragging] = useState<PinnableTab | null>(null);
  // The drawer animates in with a `transform`, which would make the fixed overlay fixed
  // to the drawer rather than the screen — so it is drawn in `<body>`, once there is one.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const byKey = new Map<string, NavItem>(items.map((item) => [item.key, item]));
  const pinned = pins.map((key) => byKey.get(key)!).filter(Boolean);
  const others = items.filter(
    (item) => item.key !== "dashboard" && !(pins as string[]).includes(item.key),
  );
  const home = byKey.get("dashboard");

  const parts = (item: NavItem) => {
    const section = SECTIONS.find((s) => s.some((seg) => seg.href === item.href));
    return section ? section.map((seg) => say(APP.sections[seg.key])).join(" · ") : null;
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over || active.id === over.id) return;
    onChange(dropPin(pins, active.id as PinnableTab, over.id as PinnableTab));
  };

  const label = (item: NavItem, note?: string) => {
    const here = pathname !== undefined && isInTab(item, pathname);
    const sub = here ? say(NAV.youAreHere) : (note ?? parts(item));
    return (
      <>
        <span className="block font-semibold text-slate-800">{item.label}</span>
        {sub && (
          <span className={`block truncate text-xs ${here ? "font-semibold text-[var(--accent-text)]" : "text-slate-500"}`}>
            {sub}
          </span>
        )}
      </>
    );
  };

  const body = (item: NavItem, place?: number) => {
    const Icon = item.icon;
    const here = pathname !== undefined && isInTab(item, pathname);
    return (
      <>
        <span aria-hidden="true" className="accent-tint-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--accent-text)]">
          <Icon className="h-5 w-5" />
        </span>
        {onOpen ? (
          <Link
            href={item.href}
            onClick={() => onOpen(item.href)}
            aria-current={here ? "page" : undefined}
            className="press-text min-w-0 flex-1 py-1"
          >
            {label(item)}
          </Link>
        ) : (
          <span className="min-w-0 flex-1">{label(item)}</span>
        )}
        {place !== undefined && (
          <span className="flex h-7 shrink-0 items-center rounded-full bg-[var(--accent)] px-2.5 text-xs font-semibold text-white" data-place={place}>
            {say(NAV.place, { n: place })}
          </span>
        )}
      </>
    );
  };

  const draggingItem = dragging ? byKey.get(dragging) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={underFinger}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={({ active }) => setDragging(active.id as PinnableTab)}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => say(NAV.dragPicked, { name: byKey.get(String(active.id))?.label ?? "" }),
          onDragOver: ({ over }) => (over ? say(NAV.dragOver, { name: byKey.get(String(over.id))?.label ?? "" }) : ""),
          onDragEnd: ({ over }) => (over ? say(NAV.dragDropped) : say(NAV.dragCancelled)),
          onDragCancel: () => say(NAV.dragCancelled),
        },
        screenReaderInstructions: { draggable: say(NAV.dragInstructions) },
      }}
    >
      <div className="flex flex-col gap-3">
        {home && onOpen && (
          <ul>
            <li className="flex min-h-14 items-center gap-3 py-1.5">{body(home)}</li>
          </ul>
        )}

        <section>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{say(NAV.inBar)}</h3>
          <ul className="mt-1 flex flex-col gap-1.5">
            {pinned.map((item, index) => (
              <PinRow key={item.key} id={item.key as PinnableTab} slot handleLabel={say(NAV.dragNamed, { name: item.label })}>
                {body(item, index + 1)}
              </PinRow>
            ))}
          </ul>
        </section>

        {others.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{say(NAV.moreTabs)}</h3>
            <ul className="mt-1 flex flex-col gap-1.5">
              {others.map((item) =>
                (PINNABLE_TABS as readonly string[]).includes(item.key) ? (
                  <PinRow key={item.key} id={item.key as PinnableTab} handleLabel={say(NAV.dragNamed, { name: item.label })}>
                    {body(item)}
                  </PinRow>
                ) : (
                  <li key={item.key} className="flex min-h-14 items-center gap-3 px-2 py-1.5">
                    {body(item)}
                  </li>
                ),
              )}
            </ul>
          </section>
        )}
      </div>
      {mounted &&
        createPortal(
          <DragOverlay dropAnimation={null} zIndex={1000}>
            {draggingItem && (
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--accent)] bg-white px-2 py-1.5 shadow-lg">
                {body(draggingItem)}
                <GripIcon />
              </div>
            )}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

/**
 * One tab that can be dragged, and dropped on. A place in the bar is drawn as a place —
 * a dashed outline round it — so it reads as somewhere to drop onto; the row a finger is
 * over is washed in the home's colour.
 */
function PinRow({
  id,
  slot = false,
  handleLabel,
  children,
}: {
  id: PinnableTab;
  slot?: boolean;
  handleLabel: string;
  children: React.ReactNode;
}) {
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });
  const over = drop.isOver && !drag.isDragging;
  return (
    <li
      ref={(node) => {
        drop.setNodeRef(node);
        drag.setNodeRef(node);
      }}
      data-pin-row={id}
      data-over={over ? "true" : undefined}
      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-2 py-1.5 transition-colors duration-(--dur-quick) ${
        over
          ? "accent-tint-bg border-[var(--accent)]"
          : slot
            ? "border-dashed border-slate-300"
            : "border-transparent"
      } ${drag.isDragging ? "opacity-40" : ""}`}
    >
      {children}
      <button
        ref={drag.setActivatorNodeRef}
        type="button"
        {...drag.listeners}
        {...drag.attributes}
        aria-label={handleLabel}
        title={handleLabel}
        className="press-icon flex h-10 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 active:cursor-grabbing"
      >
        <GripIcon />
      </button>
    </li>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

/** The same choice on `/profile`, where it is a setting rather than a way somewhere. */
export function NavPinsSetting({ pins: stored }: { pins: PinnableTab[] }) {
  const language = useLanguage();
  const [pins, setPins] = useNavPins(stored);
  return <NavPins items={navItemsFor(language)} pins={pins} onChange={setPins} />;
}
