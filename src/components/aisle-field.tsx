import type { HomeLanguage } from "@prisma/client";
import { Label } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

/**
 * Whether a list is drawn under the shop's aisles. Beside `AmountsField` in the create
 * and edit sheets, and for the same reasons written once: a list's setting, read by the
 * same action from both. Per list, because a shopping list is walked round a shop and a
 * packing list is not.
 *
 * Takes `language` rather than reaching for the context — see `AmountsField`.
 */
export function AisleField({
  defaultChecked = false,
  language,
}: {
  defaultChecked?: boolean;
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          id="groupByAisle"
          name="groupByAisle"
          type="checkbox"
          defaultChecked={defaultChecked}
          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
        />
        <Label htmlFor="groupByAisle" className="font-normal">
          {say(LISTS.groupByAisle)}
        </Label>
      </div>
      <p className="text-xs text-slate-500">{say(LISTS.groupByAisleHint)}</p>
    </div>
  );
}
