"use client";

import { useEffect, useState } from "react";
import { Card, Label, Select } from "@/components/ui";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { LEFTOVERS_LABEL, NOTHING_LABEL, OUT_LABEL, PLAN_FIELD, PLAN_OUT } from "@/lib/meals";
import { suggestionReason, type MealSuggestion } from "@/lib/meal-suggestions";
import type { FormAction } from "@/lib/action-result";

export type RecipeOption = { id: string; title: string };

/** One earlier day this one may say it is the leftovers of, ready to be an `<option>`. */
export type LeftoversOption = { value: string; label: string };

/**
 * One day of the week, and the sheet that decides what is on it.
 *
 * The whole row is the button, the way a task's card is: there is exactly one thing to do
 * with a day, so a three-dot menu would be a menu of one entry in front of it. Nothing is
 * destructive behind it either — the worst a press can do is change what Thursday says,
 * which the same sheet changes back.
 *
 * The picker is one `<select>` rather than a recipe list with ticks beside it, because
 * the row it writes holds one answer: a recipe, a night out, an earlier day's cooking
 * again, or no answer yet. A separate tick could say "eating out" and name a recipe at
 * once, and something would then have to decide which of the two the household meant.
 *
 * Above it, where the day is empty and the week has something to compare against, sit up
 * to three suggestions. **They fill the picker in and stop there.** Pressing one is the
 * same as scrolling to that name in the list — the household still presses Save, and the
 * sheet still closes on their say-so, because a page that plans the week by itself is a
 * page that has to be checked rather than read.
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
  leftovers,
  suggestions,
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
  recipes: RecipeOption[];
  /** The earlier cooked days this one can live off, already in the order they fell. */
  leftovers: LeftoversOption[];
  /** What to offer where the day is empty; empty itself where there is nothing to say. */
  suggestions: MealSuggestion[];
  action: FormAction;
  /** Today, which is the row somebody opening this page is looking for. */
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /**
   * The picker is controlled so a suggestion can fill it in, and reset to the stored
   * answer on every *open* rather than on close — closing resets a sheet that is still
   * animating away, which is the same reason `NewRecipeDialog` resets its step on open.
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

          {suggestions.length > 0 && (
            <div className="space-y-1">
              {/* Named for what it is doing rather than for the machinery: the household
                  is being shown what the week already covers, not an algorithm. */}
              <p className="text-sm font-medium">Goes well with the rest of the week</p>
              <div className="space-y-1.5">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.recipeId}
                    type="button"
                    onClick={() => setChoice(suggestion.recipeId)}
                    aria-pressed={choice === suggestion.recipeId}
                    className={`pressable block w-full rounded-xl border px-3 py-2 text-left ${
                      choice === suggestion.recipeId
                        ? "border-[var(--accent-line)] accent-tint-ring"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">{suggestion.title}</span>
                    <span className="block text-xs text-slate-500">
                      {suggestionReason(suggestion)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor={`plan-${date}`}>Eating</Label>
            <Select
              id={`plan-${date}`}
              name={PLAN_FIELD}
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              className="w-full"
            >
              {/* First, and the default for a day nobody has planned: the state the row
                  is already in should never be something to scroll to. */}
              <option value="">{NOTHING_LABEL}</option>
              <option value={PLAN_OUT}>{OUT_LABEL}</option>
              {/* Grouped, because these are days rather than dishes: without the heading
                  they read as recipes the household does not remember saving. */}
              {leftovers.length > 0 && (
                <optgroup label={LEFTOVERS_LABEL}>
                  {leftovers.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              )}
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
