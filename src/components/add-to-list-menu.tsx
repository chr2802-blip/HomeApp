"use client";

import { useState, useTransition } from "react";
import { ContextMenu, MenuItem } from "@/components/context-menu";
import { buttonClass } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

/** One list as the menu offers it: its name, and how much is still outstanding on it. */
export type ListChoice = { id: string; title: string; open: number };

/**
 * "Add to list": a recipe's ingredients, or a whole week's worth of them, onto whichever
 * of the home's lists that track amounts is chosen. An ingredient line is a quantity, and
 * a list that ignores amounts has nowhere to put it — so `lists` here is already filtered
 * to the ones that do, and a home with none is the same as a home with no lists at all.
 *
 * A menu rather than a sheet, because the whole question is which list — a dialog would
 * be a form with one field and two buttons for a choice that is one press. The lists
 * carry how many items are open on each, which is what tells the weekly shop apart from
 * the one somebody started in March.
 *
 * `action` and `extraData` are what tells this apart from a plain "add ingredients"
 * button: a recipe page sends its own id, the meal plan sends the week — the menu itself
 * only ever decides which list, the same choice either way.
 *
 * What happened is said here rather than left to the page: the menu closes on the press
 * and the list being written to is somewhere else entirely, so without a line of text
 * the only evidence would be on a screen nobody is looking at.
 */
export function AddToListMenu({
  lists,
  action,
  extraData,
}: {
  lists: ListChoice[];
  action: (formData: FormData) => Promise<ActionResult>;
  extraData: Record<string, string>;
}) {
  const [pending, startAdding] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add(list: ListChoice) {
    const data = new FormData();
    for (const [key, value] of Object.entries(extraData)) data.set(key, value);
    data.set("listId", list.id);

    setResult(null);
    startAdding(async () => {
      const outcome = await action(data);
      setResult(
        outcome?.ok === false
          ? { ok: false, message: outcome.error }
          : {
              ok: true,
              // The note is what the pantry took care of. Said here rather than left
              // out, because a household that cannot tell "we already have salt" from
              // "the salt went missing" stops trusting the button either way.
              message: [`Added to ${list.title}.`, outcome?.note].filter(Boolean).join(" "),
            },
      );
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ContextMenu
        label="Add to list"
        className={buttonClass("secondary")}
        trigger={
          <>
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Add to list
          </>
        }
      >
        {lists.length === 0 ? (
          <p className="px-3.5 py-2.5 text-sm text-slate-500">
            No lists track amounts yet — turn that on for one, then come back.
          </p>
        ) : (
          lists.map((list) => (
            <MenuItem key={list.id} icon="list" onSelect={() => add(list)}>
              <span className="min-w-0 flex-1 truncate">{list.title}</span>
              <span className="shrink-0 text-xs font-normal text-slate-400 tabular-nums">
                {list.open} open
              </span>
            </MenuItem>
          ))
        )}
      </ContextMenu>

      {/* A live region, so the outcome is announced rather than only drawn: the press
          that caused it moved focus nowhere. */}
      <p
        role="status"
        className={`text-xs ${result?.ok === false ? "text-red-600" : "text-slate-500"}`}
      >
        {pending ? "Adding…" : (result?.message ?? "")}
      </p>
    </div>
  );
}
