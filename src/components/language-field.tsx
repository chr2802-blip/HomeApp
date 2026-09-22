import type { HomeLanguage } from "@prisma/client";
import { LANGUAGES, LANGUAGE_FIELD, LANGUAGE_LABELS } from "@/lib/language";
import { sayIn, type Say } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/**
 * The language a home reads the app in, as a row of plain radios in the home's own
 * settings.
 *
 * No swatch, unlike `ThemeField` beside it: there is no colour to look at here, only a
 * word, so a label is the whole control. `LANGUAGE_LABELS` names each language in
 * itself ("Dansk", not "Danish") — a picker somebody uses to find their own language is
 * the one place that is not translated.
 *
 * The hint underneath carries the one thing worth saying before anybody presses
 * anything: switching changes what happens next, not what is already written down.
 */
export function LanguageField({ defaultLanguage }: { defaultLanguage: HomeLanguage }) {
  const say: Say = sayIn(defaultLanguage);

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">{say(SETTINGS.language.legend)}</legend>
      <p className="mt-1 text-xs text-slate-500">{say(SETTINGS.language.hint)}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <label key={language} className="pressable relative cursor-pointer active:scale-95">
            <input
              type="radio"
              name={LANGUAGE_FIELD}
              value={language}
              defaultChecked={language === defaultLanguage}
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
            />
            <span className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 peer-checked:border-[var(--accent)] peer-checked:font-medium peer-checked:text-[var(--accent-text)] peer-checked:ring-2 peer-checked:ring-[var(--accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]">
              {LANGUAGE_LABELS[language]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
