"use client";

import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";

import { AddToListMenu } from "@/components/add-to-list-menu";

import { ModalBody } from "@/components/modal";
import { SheetButton } from "@/components/sheet-button";
import { ButtonLink } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { scaleIngredient } from "@/lib/ingredient-line";
import { TIMES_CHOICES, TIMES_FIELD, TIMES_PARAM, portionsFor, stepTimes, timesLabel } from "@/lib/recipes";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

/**
 * How many times over a recipe is being made, on the recipe's own page: ½×, 1×, 2×…
 *
 * One piece of state read in four places — the stepper, its button, the ingredient list
 * and the "Start cooking" link — so the amounts on screen and the amounts at the hob are the same
 * number by construction. "Add to list" reads it too, because a recipe made twice takes
 * two stk from the pantry. A context rather than one component holding all of them,
 * because the page puts the link above the picture and the list in a card below it.
 *
 * Only ever shown, never saved on the recipe: the stored lines are the recipe as written,
 * and cooking it twice on Saturday says nothing about Tuesday. A recipe nobody has said
 * the servings of still scales — a multiplier needs nothing to scale from — and simply
 * does not say how many people that is.
 */
type Times = { servings: number | null; times: number; setTimes: (next: number) => void };

const TimesContext = createContext<Times>({ servings: null, times: 1, setTimes: () => {} });

export function TimesProvider({
  servings,
  initial,
  children,
}: {
  servings: number | null;
  /** What the address asked for (`readTimes`) — how leaving action mode comes back to
   *  the amounts it was cooking. */
  initial: number;
  children: ReactNode;
}) {
  const [times, setTimes] = useState(initial);
  return <TimesContext value={{ servings, times, setTimes }}>{children}</TimesContext>;
}

/** The multiplier being shown, for something on the page that acts on it ("Add to list"). */
export function useTimes(): number {
  return useContext(TimesContext).times;
}

/** The − 2× + control, with the people that feeds under it where the recipe knows. */
export function TimesStepper() {
  const { servings, times, setTimes } = useContext(TimesContext);
  const say = sayIn(useLanguage());
  const portions = portionsFor(servings, times);

  const button =
    "press-icon h-9 w-9 rounded-lg text-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="mb-3">
      <div
        role="group"
        aria-label={say(RECIPES.timesField)}
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-1"
      >
        <button
          type="button"
          onClick={() => setTimes(stepTimes(times, -1))}
          disabled={times <= TIMES_CHOICES[0]}
          aria-label={say(RECIPES.fewerTimes)}
          className={button}
        >
          −
        </button>
        <span data-testid="times" aria-live="polite" className="text-base font-semibold tabular-nums">
          {timesLabel(times)}
        </span>
        <button
          type="button"
          onClick={() => setTimes(stepTimes(times, 1))}
          disabled={times >= TIMES_CHOICES[TIMES_CHOICES.length - 1]}
          aria-label={say(RECIPES.moreTimes)}
          className={button}
        >
          +
        </button>
      </div>
      {portions !== null && (
        <p data-testid="portions" className="mt-1 text-center text-xs text-slate-500">
          {say(RECIPES.portions, { count: portions })}
        </p>
      )}
    </div>
  );
}

/**
 * The multiplier as an icon beside the ingredients' heading, carrying "2×", with the
 * stepper in a sheet behind it. The number stays on the page because it is what the
 * amounts below it mean; changing it is the rarer thing.
 */
export function TimesButton() {
  const { times } = useContext(TimesContext);
  const say = sayIn(useLanguage());

  return (
    <SheetButton
      label={say(RECIPES.timesField)}
      value={timesLabel(times)}
      icon={
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path
            d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20a6 6 0 0 1 12 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6 6 0 0 1 3 5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    >
      {() => (
        <ModalBody>
          <TimesStepper />
        </ModalBody>
      )}
    </SheetButton>
  );
}

/** The recipe's ingredient lines at the multiplier chosen above. */
export function ScaledIngredients({ lines }: { lines: string[] }) {
  const { times: factor } = useContext(TimesContext);
  const language = useLanguage();

  return (
    <ul className="space-y-1.5 text-sm">
      {lines.map((line, index) => (
        <li key={index} className="flex gap-2">
          <span className="text-slate-400">·</span>
          {scaleIngredient(line, factor, language)}
        </li>
      ))}
    </ul>
  );
}

/** "Start cooking", carrying the multiplier chosen, so action mode cooks the same amounts. */
export function CookLink({ recipeId, children }: { recipeId: string; children: ReactNode }) {
  const { times } = useContext(TimesContext);
  const href = `/recipes/${recipeId}/cook${times !== 1 ? `?${TIMES_PARAM}=${times}` : ""}`;
  return (
    <ButtonLink href={href} className="flex-1 sm:flex-none">
      {children}
    </ButtonLink>
  );
}

/**
 * The recipe page's "Add to list", carrying the multiplier being shown — a recipe made
 * twice takes two stk of each counted pantry entry it uses (`writeRecipesToList`), so
 * what goes on the list and what comes out of the cupboard follow the same "2×".
 */
export function RecipeAddToList({
  recipeId,
  ...menu
}: { recipeId: string } & Omit<ComponentProps<typeof AddToListMenu>, "extraData" | "sheet">) {
  const { times } = useContext(TimesContext);
  return <AddToListMenu sheet {...menu} extraData={{ recipeId, [TIMES_FIELD]: String(times) }} />;
}
