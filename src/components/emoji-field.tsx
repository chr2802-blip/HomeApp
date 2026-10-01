import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "@/lib/copy/say";
import { FACE } from "@/lib/copy/forms";
import { EMOJI_CHOICES, EMOJI_FIELD } from "@/lib/emoji";

/**
 * The face a list or a task wears on its tile, picked from a grid of radios.
 *
 * "Pick for me" comes first and is its own choice rather than a lesser one: it submits
 * an empty value, which stores null, and the tile keeps guessing from the title — so a
 * list renamed from "Groceries" to "Christmas" changes face with it.
 *
 * On a phone the faces are four rows of sixteen scrolled sideways — `EMOJI_CHOICES` is
 * written as those rows, a theme each — so the sheet keeps its fields above the fold.
 * The columns are sized to show seven and a half, and the half is what says there is
 * more. From `sm` up there is room for all of them, eight to a row.
 *
 * No `"use client"` and no context: it is rendered straight from server pages as well
 * as from inside client components, so it takes `language` as a prop (see
 * `AssigneeField`). Native radios need nothing else.
 */
export function EmojiField({
  selected = null,
  idPrefix = "emoji",
  language,
}: {
  selected?: string | null;
  idPrefix?: string;
  language: HomeLanguage;
}) {
  const say = sayIn(language);
  const chip =
    "pressable flex h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-xl active:scale-90 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[color-mix(in_srgb,var(--accent)_14%,white)] has-[:checked]:ring-2 has-[:checked]:ring-[var(--accent)]";

  return (
    <fieldset className="min-w-0 space-y-1.5">
      <legend className="block text-sm font-medium text-slate-700">{say(FACE.label)}</legend>
      <label className={`${chip} h-9 text-sm font-medium text-slate-600`}>
        <input
          type="radio"
          name={EMOJI_FIELD}
          value=""
          defaultChecked={selected === null}
          className="sr-only"
        />
        {say(FACE.auto)}
      </label>
      <div className="-mx-1 grid snap-x snap-mandatory scroll-px-1 grid-cols-[repeat(16,calc((100%-2.625rem)/7.5))] gap-1.5 overflow-x-auto p-1 sm:snap-none sm:grid-cols-8 sm:overflow-visible">
        {EMOJI_CHOICES.map((emoji, index) => (
          <label key={emoji} htmlFor={`${idPrefix}-${index}`} className={`${chip} snap-start`}>
            <input
              id={`${idPrefix}-${index}`}
              type="radio"
              name={EMOJI_FIELD}
              value={emoji}
              defaultChecked={selected === emoji}
              aria-label={emoji}
              className="sr-only"
            />
            <span aria-hidden="true">{emoji}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">{say(FACE.hint)}</p>
    </fieldset>
  );
}
