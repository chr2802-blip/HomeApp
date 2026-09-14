"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { restoreListItem } from "@/app/actions/lists";
import { AmountPicker } from "@/components/amount-picker";
import { MIN_AMOUNT } from "@/lib/amount";
import type { FormAction } from "@/lib/action-result";

export type Suggestion = { id: string; text: string };

const MAX_SUGGESTIONS = 6;

/**
 * The add box, with the list's own ticked items offered as you type.
 *
 * Most weeks a shopping list is the same list again, so everything ticked off last time
 * is the vocabulary for this time. Picking one puts it back rather than creating a
 * second copy. Suggestions are filtered here rather than on the server — the items are
 * already on the page, so there is nothing to fetch.
 */
export function AddItemForm({
  action,
  listId,
  suggestions,
  trackAmounts,
}: {
  action: FormAction;
  listId: string;
  suggestions: Suggestion[];
  trackAmounts: boolean;
}) {
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState(MIN_AMOUNT);
  const [highlighted, setHighlighted] = useState(-1);
  const [restoring, startRestore] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const { state, pending, handleSubmit } = useFormAction(action, {
    onSuccess: (form) => {
      form.reset();
      setQuery("");
      // Back to one for the next item: the amount belongs to the thing just added, not
      // to everything typed after it.
      setAmount(MIN_AMOUNT);
      setHighlighted(-1);
    },
  });

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? suggestions.filter((item) => item.text.toLowerCase().includes(needle)).slice(0, MAX_SUGGESTIONS)
    : [];
  const isOpen = matches.length > 0;

  function restore(item: Suggestion) {
    const data = new FormData();
    data.set("itemId", item.id);
    data.set("amount", String(amount));

    setQuery("");
    setAmount(MIN_AMOUNT);
    setHighlighted(-1);
    inputRef.current?.focus();

    startRestore(async () => {
      await restoreListItem(data);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted((current) => (current + step + matches.length) % matches.length);
      return;
    }
    if (event.key === "Enter" && highlighted >= 0) {
      // Take the highlighted suggestion instead of submitting a new item.
      event.preventDefault();
      restore(matches[highlighted]!);
      return;
    }
    if (event.key === "Escape") {
      setHighlighted(-1);
      setQuery("");
    }
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input type="hidden" name="listId" value={listId} />
          {trackAmounts && (
            <>
              <input type="hidden" name="amount" value={amount} />
              <AmountPicker value={amount} onChange={setAmount} label="Amount" />
            </>
          )}
          <Input
            ref={inputRef}
            name="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder="Add an item"
            required
            autoComplete="off"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="item-suggestions"
            aria-autocomplete="list"
            className="flex-1"
          />
          <Button type="submit" disabled={pending || restoring} aria-busy={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
        {state?.ok === false && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
      </form>

      {isOpen && (
        <ul
          id="item-suggestions"
          role="listbox"
          aria-label="Already on this list"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <li className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">
            Ticked off earlier — pick one to put it back
          </li>
          {matches.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => restore(item)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  index === highlighted ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <span className="text-slate-400">↩</span>
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
