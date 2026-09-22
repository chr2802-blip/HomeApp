"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { restoreListItem } from "@/app/actions/lists";
import { AmountPicker } from "@/components/amount-picker";
import { useOfflineList } from "@/components/use-offline-list";
import { newId } from "@/lib/offline-queue";
import type { OfflineOp } from "@/lib/offline-ops";
import { clampAmount, MIN_AMOUNT } from "@/lib/amount";
import { ok, type FormAction } from "@/lib/action-result";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

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
  const { record } = useOfflineList(listId);
  const say = sayIn(useLanguage());

  /**
   * Adding, whether or not there is anybody to add it with.
   *
   * The row's id is chosen here rather than by the database, because with no connection
   * the row has to exist on this phone before it exists anywhere — and creating it under
   * that id when the queue is finally sent is what makes a second send add one item
   * instead of two.
   *
   * A queued add reports success, because it succeeded: it is on the list, and the list is
   * what the box is for. What the server might later have to say about it — that a line
   * already there was wanted once more, or that an unticked one is already there — is a
   * conversation that needs a server, and the reply arrives as the list itself.
   */
  const submit: FormAction = async (previous, data) => {
    const text = String(data.get("text") ?? "").trim();
    const wanted = clampAmount(data.get("amount") ?? MIN_AMOUNT);
    if (!text) return action(previous, data);

    const outcome = await record(
      [{ id: newId(), kind: "add", listId, itemId: newId(), text, amount: wanted }],
      () => action(previous, data),
    );
    return outcome.sent ? outcome.result : ok();
  };

  const { state, pending, handleSubmit } = useFormAction(submit, {
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
    const wanted = amount;
    const data = new FormData();
    data.set("itemId", item.id);
    data.set("amount", String(wanted));

    setQuery("");
    setAmount(MIN_AMOUNT);
    setHighlighted(-1);
    inputRef.current?.focus();

    /*
     * Putting a ticked item back, with the queue's two words for it.
     *
     * Online this is one action, which also moves the row to the end of what is still
     * outstanding. Queued it is a tick and an amount — the two things the row has to say —
     * and the row stays where it is until the send goes through, because a position is the
     * one part of this that two phones can disagree about.
     */
    const ops: OfflineOp[] = [
      { id: newId(), kind: "tick", listId, itemId: item.id, done: false },
      { id: newId(), kind: "amount", listId, itemId: item.id, amount: wanted },
    ];

    startRestore(async () => {
      await record(ops, () => restoreListItem(data));
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
              <AmountPicker value={amount} onChange={setAmount} label={say(LISTS.amount)} />
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
            placeholder={say(LISTS.addItem)}
            required
            autoComplete="off"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="item-suggestions"
            aria-autocomplete="list"
            className="flex-1"
          />
          <Button type="submit" disabled={pending || restoring} aria-busy={pending}>
            {pending ? say(LISTS.adding) : say(LISTS.add)}
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
          aria-label={say(LISTS.alreadyOnList)}
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <li className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-500">
            {say(LISTS.pickOneBack)}
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
