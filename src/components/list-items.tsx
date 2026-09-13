"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { deleteListItem, reorderListItems, toggleListItem } from "@/app/actions/lists";
import { ConfirmButton } from "@/components/confirm-button";

type Item = { id: string; text: string; done: boolean; position: number };

type Change =
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string }
  | { type: "reorder"; ids: string[] };

function applyTo(items: Item[], change: Change): Item[] {
  if (change.type === "toggle") {
    return items.map((item) => (item.id === change.id ? { ...item, done: !item.done } : item));
  }
  if (change.type === "remove") {
    return items.filter((item) => item.id !== change.id);
  }

  // Re-number to the dragged order so the row stays where it was dropped while the
  // server catches up.
  const rank = new Map(change.ids.map((id, index) => [id, index + 1]));
  return items.map((item) => ({ ...item, position: rank.get(item.id) ?? item.position }));
}

/** Open items first, then ticked ones — each group in its own running order. */
function sorted(items: Item[]) {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position);
}

function Row({
  item,
  draggable,
  onToggle,
  onRemove,
}: {
  item: Item;
  draggable: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-white px-2 py-2.5 sm:px-4 ${
        isDragging ? "relative z-10 opacity-80 shadow-md" : ""
      }`}
    >
      {draggable ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.text}`}
          // touch-none stops the browser scrolling the page instead of dragging. The
          // padding is generous on purpose: this is dragged with a thumb, in a kitchen.
          className="touch-none cursor-grab rounded px-2 py-3 text-slate-400 hover:text-slate-700 focus-visible:outline-2 active:cursor-grabbing"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="5" r="1.5" />
            <circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" />
            <circle cx="13" cy="15" r="1.5" />
          </svg>
        </button>
      ) : (
        <span className="w-8 shrink-0" aria-hidden="true" />
      )}

      <form action={onToggle} className="flex flex-1 items-center gap-3">
        <button
          type="submit"
          aria-label={item.done ? "Mark as not done" : "Mark as done"}
          aria-pressed={item.done}
          className={`pressable flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs active:scale-90 ${
            item.done ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
          }`}
        >
          {item.done ? "✓" : ""}
        </button>
        <span
          className={`flex-1 text-left text-sm transition-colors duration-150 ${
            item.done ? "text-slate-400 line-through" : ""
          }`}
        >
          {item.text}
        </span>
      </form>

      <form action={onRemove}>
        <ConfirmButton
          title="Remove item"
          confirmLabel="Remove"
          message={`Remove "${item.text}" from this list?`}
          triggerVariant="ghost"
          triggerClassName="px-2 py-1 text-sm text-slate-400 hover:text-red-600"
        >
          Remove
        </ConfirmButton>
      </form>
    </div>
  );
}

export function ListItems({ listId, items }: { listId: string; items: Item[] }) {
  const [optimisticItems, applyChange] = useOptimistic(items, applyTo);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    // A little movement before a drag starts, so tapping the handle on a phone does
    // not read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = sorted(optimisticItems);
  const open = visible.filter((item) => !item.done);
  const done = visible.filter((item) => item.done);

  if (visible.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">This list is empty.</p>;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = open.map((item) => item.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    ids.splice(to, 0, ids.splice(from, 1)[0]!);

    const data = new FormData();
    data.set("listId", listId);
    data.set("itemIds", ids.join(","));

    startTransition(async () => {
      applyChange({ type: "reorder", ids });
      await reorderListItems(data);
    });
  }

  function rowFor(item: Item, draggable: boolean) {
    const payload = new FormData();
    payload.set("itemId", item.id);

    return (
      <Row
        key={item.id}
        item={item}
        draggable={draggable}
        onToggle={async () => {
          applyChange({ type: "toggle", id: item.id });
          await toggleListItem(payload);
        }}
        onRemove={async () => {
          applyChange({ type: "remove", id: item.id });
          await deleteListItem(payload);
        }}
      />
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={open.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-slate-100">
            {open.map((item) => rowFor(item, true))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Ticked items keep their own order at the bottom and are not draggable, so a
          dragged row cannot land somewhere the sort would immediately undo. */}
      {done.length > 0 && (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {done.map((item) => rowFor(item, false))}
        </div>
      )}
    </>
  );
}
