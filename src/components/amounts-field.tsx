import { Label } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

/**
 * The one setting a list has: whether its items carry a quantity.
 *
 * Shared by the create and edit sheets rather than written twice, so the wording and the
 * field name cannot drift apart — the action reads the same checkbox from both.
 */
export function AmountsField({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const say = sayIn(useLanguage());

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
