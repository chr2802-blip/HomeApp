import type { HomeLanguage, ListGrouping } from "@prisma/client";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

/** The ways a list can be drawn, in the order they are offered. */
const GROUPINGS: ListGrouping[] = ["NONE", "AISLE", "OWN"];

const WORDING = {
  NONE: { label: LISTS.groupingNone, hint: LISTS.groupingNoneHint },
  AISLE: { label: LISTS.groupByAisle, hint: LISTS.groupByAisleHint },
  OWN: { label: LISTS.groupByOwn, hint: LISTS.groupByOwnHint },
} as const;

/**
 * How a list's open items are drawn: in the household's own order, under the shop's
 * aisles, or under headings this list keeps for itself. Beside `AmountsField` in the
 * create and edit sheets, and for the same reasons written once: a list's setting, read
 * by the same action from both.
 *
 * Radios rather than two checkboxes, because the answers exclude each other — see
 * `List.grouping`.
 *
 * Takes `language` rather than reaching for the context — see `AmountsField`.
 */
export function GroupingField({
  defaultValue = "NONE",
  language,
}: {
  defaultValue?: ListGrouping;
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-slate-700">{say(LISTS.grouping)}</legend>
      {GROUPINGS.map((grouping) => (
        <label key={grouping} className="flex items-start gap-2">
          <input
            type="radio"
            name="grouping"
            value={grouping}
            defaultChecked={grouping === defaultValue}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
          />
          <span className="min-w-0">
            <span className="block text-sm text-slate-800">{say(WORDING[grouping].label)}</span>
            <span className="block text-xs text-slate-500">{say(WORDING[grouping].hint)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
