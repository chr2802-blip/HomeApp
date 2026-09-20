"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { MealPicker, type PlanGroup } from "@/components/meal-picker";
import { PLAN_FIELD } from "@/lib/meals";
import type { FormAction } from "@/lib/action-result";

export type RecipeOption = { id: string; title: string };

/** One earlier day this one may say it is the leftovers of, ready to be a row. */
export type LeftoversOption = { value: string; label: string };

/**
 * One day of the week, and the sheet that decides what is on it.
 *
 * The whole row is the button, the way a task's card is: there is exactly one thing to do
 * with a day, so a three-dot menu would be a menu of one entry in front of it. Nothing is
 * destructive behind it either — the worst a press can do is change what Thursday says,
 * which the same sheet changes back.
 *
 * Inside, `MealPicker` is one radio group rather than a picker with ticks beside it,
 * because the row it writes holds one answer: a recipe, a night out, an earlier day's
 * cooking again, or no answer yet. A separate tick could say "eating out" and name a
 * recipe at once, and something would then have to decide which of the two the household
 * meant; leftovers would be a second such tick, able to disagree with the first.
 *
 * **The suggestions are a group inside that list, not a row of chips above it.** They
 * were chips while the list below them was a native `<select>` — two different ways of
 * choosing a recipe, in one sheet, because one of them could not draw a reason. Now that
 * every row can, a suggestion is simply a recipe the list has a reason to put first, and
 * there is one place to look instead of two. Nothing is written on the household's
 * behalf either way: choosing a row fills the form in, and Save is still theirs.
 *
 * `children` is the row's face, rendered by the page on the server — the recipe's picture
 * and title, or the words for an empty evening. Only the opening and closing of the sheet
 * needs a browser.
 */
export function MealDay({
  date,
  title,
  selected,
  groups,
  action,
  highlighted = false,
  children,
}: {
  /** The day this row is for, as "yyyy-MM-dd" in the home's zone. */
  date: string;
  /** What the sheet is called: the weekday and the date, so it says which day it writes. */
  title: string;
  /**
   * The picker's current value: a recipe id, a leftovers choice, `PLAN_OUT`, or "" for
   * nothing planned.
   */
  selected: string;
  /** Every choice the day has, in the order the sheet offers them. */
  groups: PlanGroup[];
  action: FormAction;
  /** Today, which is the row somebody opening this page is looking for. */
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /**
   * The picker is controlled, and resets to the stored answer on every *open* rather
   * than on close — closing resets a sheet that is still animating away, which is the
   * same reason `NewRecipeDialog` resets its step on open.
   */
  const [choice, setChoice] = useState(selected);
  useEffect(() => {
    if (open) setChoice(selected);
  }, [open, selected]);

  return (
    <>
      <Card
        padded={false}
        className={`overflow-hidden ${highlighted ? "border-[var(--accent-line)] accent-tint-ring" : ""}`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          // Hydration leaves no mark of its own, so the trigger says when it can
          // actually open — what a browser test waits on instead of the markup, which
          // looks identical before React has attached anything to it.
          data-ready="true"
          className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
        >
          {children}
        </button>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <DialogForm
          action={action}
          submitLabel="Save"
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        >
          <input type="hidden" name="date" value={date} />
          <MealPicker
            name={PLAN_FIELD}
            groups={groups}
            selected={choice}
            onSelect={setChoice}
          />
        </DialogForm>
      </Modal>
    </>
  );
}
