import type { HomeLanguage } from "@prisma/client";
import { SEASONAL_FIELD } from "@/lib/season";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/**
 * The switch for a home's seasonal touches, in the Home card beside the colour.
 *
 * A checkbox says nothing at all when it is unticked, and a field the form does not
 * mention is left alone by `updateHome` — so a hidden "off" goes first under the same
 * name, and a ticked box's "on" after it. `readForm` keeps the last of a repeated field,
 * which is exactly the one that should win.
 */
export function SeasonalField({ defaultOn, language }: { defaultOn: boolean; language: HomeLanguage }) {
  const say = sayIn(language);

  return (
    <div className="space-y-1">
      <input type="hidden" name={SEASONAL_FIELD} value="off" />
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name={SEASONAL_FIELD}
          value="on"
          defaultChecked={defaultOn}
          className="h-4 w-4 rounded border-slate-300 accent-[var(--accent)]"
        />
        {say(SETTINGS.seasonal.label)}
      </label>
      <p className="text-xs text-slate-500">{say(SETTINGS.seasonal.hint)}</p>
    </div>
  );
}
