"use client";

import { useState } from "react";
import { Card, Label, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { NOTHING_LABEL, OUT_LABEL, PLAN_FIELD, PLAN_OUT } from "@/lib/meals";
import type { FormAction } from "@/lib/action-result";

export type RecipeOption = { id: string; title: string };

/**
 * One day of the week, and the sheet that decides what is on it.
 *
 * The whole row is the button, the way a task's card is: there is exactly one thing to do
 * with a day, so a three-dot menu would be a menu of one entry in front of it. Nothing is
 * destructive behind it either — the worst a press can do is change what Thursday says,
 * which the same sheet changes back.
 *
 * The picker is one `<select>` rather than a recipe list with an "eating out" tick beside
 * it, because the row it writes has three states and not four: a recipe, a night out, or
 * no answer yet. A separate tick could say "eating out" and name a recipe at once, and
 * something would then have to decide which of the two the household meant.
 *
 * `children` is the row's face, rendered by the page on the server — the recipe's picture
 * and title, or the words for an empty evening. Only the opening and closing of the sheet
 * needs a browser.
 */
export function MealDay({
  date,
  title,
  selected,
  recipes,
  action,
  highlighted = false,
  children,
}: {
  /** The day this row is for, as "yyyy-MM-dd" in the home's zone. */
  date: string;
  /** What the sheet is called: the weekday and the date, so it says which day it writes. */
  title: string;
  /** The picker's current value: a recipe id, `PLAN_OUT`, or "" for nothing planned. */
  selected: string;
  recipes: RecipeOption[];
  action: FormAction;
  /** Today, which is the row somebody opening this page is looking for. */
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        padded={false}
        className={`overflow-hidden ${highlighted ? "border-[var(--accent-line)] accent-tint-ring" : ""}`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
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
          <div className="space-y-1">
            <Label htmlFor={`plan-${date}`}>Eating</Label>
            <Select
              id={`plan-${date}`}
              name={PLAN_FIELD}
              defaultValue={selected}
              className="w-full"
            >
              {/* First, and the default for a day nobody has planned: the state the row
                  is already in should never be something to scroll to. */}
              <option value="">{NOTHING_LABEL}</option>
              <option value={PLAN_OUT}>{OUT_LABEL}</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.title}
                </option>
              ))}
            </Select>
            {recipes.length === 0 && (
              <p className="text-xs text-slate-500">
                No recipes saved yet — add some on the Recipes tab, or say you are eating out.
              </p>
            )}
          </div>
        </DialogForm>
      </Modal>
    </>
  );
}
