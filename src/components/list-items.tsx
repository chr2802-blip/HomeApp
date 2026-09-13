"use client";

import { useOptimistic } from "react";
import { deleteListItem, toggleListItem } from "@/app/actions/lists";
import { ConfirmButton } from "@/components/confirm-button";

type Item = { id: string; text: string; done: boolean; position: number };

type Change = { type: "toggle" | "remove"; id: string };

/** Same order the server returns: open items first, then by position. */
function sorted(items: Item[]) {
  return [...items].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.position - b.position,
  );
}

export function ListItems({ items }: { items: Item[] }) {
  const [optimisticItems, applyChange] = useOptimistic(items, (state, change: Change) =>
    change.type === "toggle"
      ? state.map((item) => (item.id === change.id ? { ...item, done: !item.done } : item))
      : state.filter((item) => item.id !== change.id),
  );

  const visible = sorted(optimisticItems);

  if (visible.length === 0) {
    return <p className="p-6 text-center text-sm text-slate-500">This list is empty.</p>;
  }

  return (
    <>
      {visible.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
          <form
            // The tick lands immediately; the server call catches up behind it.
            action={async (formData) => {
              applyChange({ type: "toggle", id: item.id });
              await toggleListItem(formData);
            }}
            className="flex flex-1 items-center gap-3"
          >
            <input type="hidden" name="itemId" value={item.id} />
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

          <form
            action={async (formData) => {
              applyChange({ type: "remove", id: item.id });
              await deleteListItem(formData);
            }}
          >
            <input type="hidden" name="itemId" value={item.id} />
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
      ))}
    </>
  );
}
