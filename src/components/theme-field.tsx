import type { HomeLanguage, HomeTheme } from "@prisma/client";
import { THEMES, THEME_FIELD } from "@/lib/theme";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/**
 * The colour a home is dressed in, as a row of swatches in the home's own settings.
 *
 * Radio buttons rather than a colour picker, and rather than a `Select`: the choice is
 * a colour, so it is made by looking at colours. What is drawn is the swatch and what
 * is pressed is the radio itself, invisible over the top of it, so the keyboard and a
 * screen reader get a plain group of radios named after the colours.
 *
 * Each swatch carries its own `data-theme`, so it paints itself from that theme's
 * variables instead of the ones the page is currently wearing. Nothing here knows what
 * any of the colours are — only globals.css does, and a swatch is therefore the colour
 * itself rather than a copy of it that drifts.
 *
 * The one that is chosen is ringed rather than filled: `peer-checked` reaches the
 * radio's siblings and not their children, so a filled chip could not also have kept
 * its dot — and the dot is the colour, which is the thing being chosen.
 *
 * No JavaScript: it is `peer-checked` doing the work, so the picker is as usable before
 * the page hydrates as after — and so no `useLanguage()` either: the language is a prop,
 * as it is for every component with no boundary of its own.
 */
export function ThemeField({
  defaultTheme,
  language,
}: {
  defaultTheme: HomeTheme;
  language: HomeLanguage;
}) {
  const say = sayIn(language);
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-slate-700">{say(SETTINGS.colour.legend)}</legend>
      <p className="mt-1 text-xs text-slate-500">{say(SETTINGS.colour.hint)}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {THEMES.map((theme) => (
          <label
            key={theme}
            data-theme={theme}
            className="pressable relative cursor-pointer active:scale-95"
          >
            {/* Invisible but laid over the whole swatch, rather than tucked away in a
                corner of it: the radio is then the thing being pressed, which is what
                it claims to be. Hiding it with `sr-only` left it a pixel the label
                itself covered, so a press landed on the label and never on the
                control. */}
            <input
              type="radio"
              name={THEME_FIELD}
              value={theme}
              defaultChecked={theme === defaultTheme}
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
            />
            <span className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-2 text-sm text-slate-700 peer-checked:border-[var(--accent)] peer-checked:font-medium peer-checked:text-[var(--accent-text)] peer-checked:ring-2 peer-checked:ring-[var(--accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]">
              <span
                aria-hidden
                className="h-4 w-4 rounded-full bg-[var(--accent)] ring-1 ring-slate-900/10"
              />
              {say(SETTINGS.colour.names[theme])}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
