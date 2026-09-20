"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { PhotoThumb } from "@/components/photo";

/** One thing a day can be set to, drawn as a row and submitted as one value. */
export type PlanOption = {
  /** What `PLAN_FIELD` carries when this row is the chosen one. */
  value: string;
  label: string;
  /** The recipe's picture, where the row is a recipe. Only the id, never the bytes. */
  photoId?: string | null;
  /** The line under the label: why it is suggested, or when it was last cooked. */
  note?: string;
  /**
   * What the search box reads, beyond the label — a recipe's ingredients and
   * description. A cook's question is more often "what can I do with the feta" than
   * "what was that called", which is the same reason `RecipeDirectory` searches them.
   */
  searchText?: string;
};

/** A headed run of options. A heading of null is the pair at the top, which needs none. */
export type PlanGroup = { heading: string | null; options: PlanOption[] };

/**
 * The control that decides what a day is eating: a search box, and every choice under a
 * heading that says why it is being offered.
 *
 * **It is a list of radios, not a `<select>` and not a combobox.** A native picker holds
 * one line of text per row, which is no way to tell two hundred recipes apart, and it
 * cannot be searched — and a home with a full collection was being asked to scroll all
 * of it. An ARIA combobox would draw the same rows, but it is a pile of roles and
 * keyboard handling to get subtly wrong, and this app has no other one to copy from.
 * Radios sharing a `name` are already a single-choice group that browsers and screen
 * readers both understand, and **they keep the whole control to one field**: every state
 * a day has still arrives through `PLAN_FIELD`, exactly as it did through the `<select>`.
 *
 * **The order is what makes a long collection usable, more than the search box is.**
 * Searching only helps somebody who already knows what they want; the groups are for
 * everyone else, and they are arranged so the rows a household would plausibly pick are
 * the ones on screen when the sheet opens.
 *
 * **A recipe appears once, under the first group that claims it.** The groups are a
 * partition rather than a set of views, so nothing is offered twice — which a `Suggested`
 * and a `Recently planned` holding the same lasagne would do, and which reads as the
 * sheet having lost count rather than as two good reasons to cook it.
 */
export function MealPicker({
  name,
  groups,
  selected,
  onSelect,
}: {
  /** The one field every row submits through. */
  name: string;
  groups: PlanGroup[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const { shown, hits } = useMemo(() => {
    if (!needle) return { shown: groups, hits: 0 };

    let hits = 0;
    const shown = groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => {
          const match = `${option.label}\n${option.searchText ?? ""}`
            .toLowerCase()
            .includes(needle);
          if (match) hits += 1;

          // The chosen row always survives the filter, whatever is typed, even though it
          // is not a hit. A radio that leaves the page takes its value out of the form
          // with it, and a `PLAN_FIELD` that arrives empty does not mean "no change" —
          // it means "nothing planned", which deletes the day. Searching is not a way to
          // clear an evening.
          return match || option.value === selected;
        }),
      }))
      // A heading with nothing under it tells the reader nothing about what is in the
      // house, the same way the recipes page leaves an empty category out.
      .filter((group) => group.options.length > 0);

    return { shown, hits };
  }, [groups, needle, selected]);

  // The pair at the top is always there, so it says nothing about whether the home has
  // anything to cook. A headed group is what a recipe or a leftovers day arrives in.
  const hasChoices = groups.some((group) => group.heading !== null);

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-1 text-sm font-medium">Eating</legend>

      {/* No autofocus: on a phone the sheet is the whole screen, and a keyboard opening
          with it would bury the list somebody has just asked to see. */}
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search recipes and ingredients"
        aria-label="Search recipes"
        className="w-full"
      />

      <div className="space-y-3">
        {shown.map((group) => (
          <div key={group.heading ?? "top"} className="space-y-1">
            {group.heading && (
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                {group.heading}
              </p>
            )}

            <div className="space-y-1">
              {group.options.map((option) => {
                const chosen = option.value === selected;

                return (
                  // The label is the whole row and holds the input, so the picture and
                  // the words are as pressable as the circle — and the circle is drawn
                  // rather than hidden behind them. A row that is only a tinted border
                  // says "chosen" to somebody who can see it and nothing to a thumb
                  // looking for what to press.
                  <label
                    key={option.value}
                    className={`pressable flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left has-focus-visible:ring-2 has-focus-visible:ring-[var(--accent)] ${
                      chosen
                        ? "border-[var(--accent-line)] accent-tint-ring"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={option.value}
                      checked={chosen}
                      onChange={() => onSelect(option.value)}
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />

                    {option.photoId !== undefined && (
                      <PhotoThumb photoId={option.photoId} alt="" className="h-9 w-9" placeholder />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{option.label}</span>
                      {option.note && (
                        <span className="block truncate text-xs text-slate-500">{option.note}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* Counted from the hits rather than from what is on screen: the row already
            chosen is still drawn, so a list that is down to that one row alone has still
            found nothing, and saying so is the difference between a search that failed
            and a search that quietly returned the answer already given. */}
        {needle !== "" && hits === 0 && (
          <p className="py-2 text-sm text-slate-500">Nothing here matches “{query.trim()}”.</p>
        )}
      </div>

      {!hasChoices && (
        <p className="text-xs text-slate-500">
          No recipes saved yet — add some on the Recipes tab, or say you are eating out.
        </p>
      )}
    </fieldset>
  );
}
