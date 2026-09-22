"use client";

import { useState, useTransition } from "react";
import { ContextMenu, MenuItem } from "@/components/context-menu";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { Button, buttonClass } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import {
  pantryNote,
  PANTRY_CONFIRM_FIELD,
  PANTRY_KEEP_FIELD,
  type AmbiguousLine,
  type PantryDecision,
} from "@/lib/pantry";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

/** One list as the menu offers it: its name, and how much is still outstanding on it. */
export type ListChoice = { id: string; title: string; open: number };

/** A press waiting on an answer: which of its ambiguous lines to still add. */
type Decision = { list: ListChoice; lines: AmbiguousLine[]; keep: Set<string> };

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
 *
 * Pressing a list can come back asking a further question rather than saying what
 * happened — a line naming more than one thing where the pantry has some but not all
 * of it. Nothing is written until that is answered, which is what `Decision` holds.
 */
export function AddToListMenu({
  lists,
  action,
  extraData,
}: {
  lists: ListChoice[];
  action: (formData: FormData) => Promise<ActionResult | PantryDecision>;
  extraData: Record<string, string>;
}) {
  const [pending, startAdding] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const language = useLanguage();
  const say = sayIn(language);

  function submit(list: ListChoice, resolved?: Set<string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(extraData)) data.set(key, value);
    data.set("listId", list.id);
    if (resolved) {
      data.set(PANTRY_CONFIRM_FIELD, "1");
      for (const key of resolved) data.append(PANTRY_KEEP_FIELD, key);
    }

    setResult(null);
    startAdding(async () => {
      const outcome = await action(data);

      // Neither success nor failure: a line the pantry only partly answers for, put to
      // the household rather than guessed at either way. Nothing has been written yet —
      // confirming re-submits with an answer, which is the only path back to `action`.
      if (outcome && "needsDecision" in outcome) {
        setDecision({ list, lines: outcome.lines, keep: new Set(outcome.lines.map((l) => l.key)) });
        return;
      }

      setResult(
        outcome?.ok === false
          ? { ok: false, message: outcome.error }
          : {
              ok: true,
              // The note is what the pantry took care of. Said here rather than left
              // out, because a household that cannot tell "we already have salt" from
              // "the salt went missing" stops trusting the button either way.
              message: [say(APP.addToList.addedTo, { list: list.title }), outcome?.note]
                .filter(Boolean)
                .join(" "),
            },
      );
    });
  }

  function add(list: ListChoice) {
    setDecision(null);
    submit(list);
  }

  function toggleKeep(key: string) {
    setDecision((current) => {
      if (!current) return current;
      const keep = new Set(current.keep);
      if (keep.has(key)) keep.delete(key);
      else keep.add(key);
      return { ...current, keep };
    });
  }

  function confirmDecision() {
    if (!decision) return;
    const { list, keep } = decision;
    setDecision(null);
    submit(list, keep);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ContextMenu
        label={say(APP.addToList.label)}
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
            {say(APP.addToList.label)}
          </>
        }
      >
        {lists.length === 0 ? (
          <p className="px-3.5 py-2.5 text-sm text-slate-500">{say(APP.addToList.noLists)}</p>
        ) : (
          lists.map((list) => (
            <MenuItem key={list.id} icon="list" onSelect={() => add(list)}>
              <span className="min-w-0 flex-1 truncate">{list.title}</span>
              <span className="shrink-0 text-xs font-normal text-slate-400 tabular-nums">
                {say(APP.addToList.open, { count: list.open })}
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
        {pending ? say(APP.addToList.adding) : (result?.message ?? "")}
      </p>

      {/* Only for the lines the pantry can't answer for on its own — a line it has
          none of or all of never reaches here at all. Checked by default: leaving
          every box alone adds the same lines a press always used to. */}
      <Modal
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={say(APP.addToList.decisionTitle)}
      >
        {decision && (
          <>
            <ModalBody className="space-y-3">
              {decision.lines.map((line) => (
                <label key={line.key} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={decision.keep.has(line.key)}
                    onChange={() => toggleKeep(line.key)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                  />
                  <span>
                    <span className="block text-slate-900">{line.text}</span>
                    <span className="block text-slate-500">{pantryNote(line.matched, language)}</span>
                  </span>
                </label>
              ))}
            </ModalBody>
            <ModalFooter>
              <div className="flex gap-2">
                <Button type="button" onClick={confirmDecision} className="flex-1 sm:flex-none">
                  {say(APP.addToList.addChecked)}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setDecision(null)}>
                  {say(APP.cancel)}
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
