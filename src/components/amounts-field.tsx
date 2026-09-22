import type { HomeLanguage } from "@prisma/client";
import { Label } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

/**
 * The one setting a list has: whether its items carry a quantity.
 *
 * Shared by the create and edit sheets rather than written twice, so the wording and the
 * field name cannot drift apart — the action reads the same checkbox from both.
 *
 * Rendered from a server component page as often as from a client one — see
 * `AssigneeField` — so it takes `language` as a prop rather than reaching for
 * `useLanguage()`.
 */
export function AmountsField({
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
          id="trackAmounts"
          name="trackAmounts"
          type="checkbox"
          defaultChecked={defaultChecked}
          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
        />
        <Label htmlFor="trackAmounts" className="font-normal">
          {say(LISTS.trackAmounts)}
        </Label>
      </div>
      <p className="text-xs text-slate-500">{say(LISTS.trackAmountsHint)}</p>
    </div>
  );
}
