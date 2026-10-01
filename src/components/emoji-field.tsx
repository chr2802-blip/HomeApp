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
    <fieldset className="space-y-1.5">
      <legend className="block text-sm font-medium text-slate-700">{say(FACE.label)}</legend>
      <div className="grid grid-cols-8 gap-1.5">
        <label className={`${chip} col-span-8 h-9 text-sm font-medium text-slate-600`}>
          <input
            type="radio"
            name={EMOJI_FIELD}
            value=""
            defaultChecked={selected === null}
            className="sr-only"
          />
          {say(FACE.auto)}
        </label>
        {EMOJI_CHOICES.map((emoji, index) => (
          <label key={emoji} htmlFor={`${idPrefix}-${index}`} className={chip}>
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
