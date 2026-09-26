"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { ModalBody } from "@/components/modal";
import { SheetButton } from "@/components/sheet-button";
import { ButtonLink } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { scaleIngredient } from "@/lib/ingredient-line";
import { MAX_SERVINGS, PORTIONS_PARAM } from "@/lib/recipes";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

/**
 * How many a recipe is being cooked for, on the recipe's own page.
 *
 * One piece of state read in four places — the stepper, its button, the ingredient list
 * and the "Start cooking" link — so the amounts on screen and the amounts at the hob are the same
 * number by construction. A context rather than one component holding all three, because
 * the page puts the link above the picture and the list in a card below it.
 *
 * Only ever shown, never saved: the stored lines are the recipe as written, and cooking
 * for six on Saturday says nothing about Tuesday. `servings` null is a recipe stored
 * before anybody was asked, which has nothing to scale from and is drawn as it stands.
 */
type Portions = { servings: number | null; portions: number | null; setPortions: (next: number) => void };

const PortionsContext = createContext<Portions>({ servings: null, portions: null, setPortions: () => {} });

export function PortionsProvider({
  servings,
  initial,
  children,
}: {
  servings: number | null;
  /** What the address asked for (`portionsShown`) — how leaving action mode comes back
   *  to the amounts it was cooking. */
  initial: number | null;
  children: ReactNode;
}) {
  const [portions, setPortions] = useState(initial);
  return <PortionsContext value={{ servings, portions, setPortions }}>{children}</PortionsContext>;
}

/** The − 4 portions + control, drawn only where there is something to scale from. */
export function PortionsStepper() {
  const { servings, portions, setPortions } = useContext(PortionsContext);
  const say = sayIn(useLanguage());
  if (servings === null || portions === null) return null;

  const button =
    "pressable h-9 w-9 rounded-lg text-lg text-slate-600 hover:bg-slate-100 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="mb-3">
      <div
        role="group"
        aria-label={say(RECIPES.servingsField)}
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-1"
      >
        <button
          type="button"
          onClick={() => setPortions(portions - 1)}
          disabled={portions <= 1}
          aria-label={say(RECIPES.fewerPortions)}
          className={button}
        >
          −
        </button>
        <span data-testid="portions" aria-live="polite" className="text-sm font-medium tabular-nums">
          {say(RECIPES.portions, { count: portions })}
        </span>
        <button
          type="button"
          onClick={() => setPortions(portions + 1)}
          disabled={portions >= MAX_SERVINGS}
          aria-label={say(RECIPES.morePortions)}
          className={button}
        >
          +
        </button>
      </div>
      {portions !== servings && (
        <p className="mt-1 text-xs text-slate-500">{say(RECIPES.scaledFrom, { count: servings })}</p>
      )}
    </div>
  );
}

/**
 * The portions as an icon beside the ingredients' heading, carrying the number being
 * cooked for, with the stepper in a sheet behind it. The number stays on the page because
 * it is what the amounts below it mean; changing it is the rarer thing.
 */
export function PortionsButton() {
  const { servings, portions } = useContext(PortionsContext);
  const say = sayIn(useLanguage());
  if (servings === null || portions === null) return null;

  return (
    <SheetButton
      label={say(RECIPES.servingsField)}
      value={portions}
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
          <PortionsStepper />
        </ModalBody>
      )}
    </SheetButton>
  );
}

/** The recipe's ingredient lines at the portions chosen above. */
export function ScaledIngredients({ lines }: { lines: string[] }) {
  const { servings, portions } = useContext(PortionsContext);
  const language = useLanguage();
  const factor = servings && portions ? portions / servings : 1;

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

/** "Start cooking", carrying the portions chosen, so action mode cooks the same amounts. */
export function CookLink({ recipeId, children }: { recipeId: string; children: ReactNode }) {
  const { servings, portions } = useContext(PortionsContext);
  const scaled = servings !== null && portions !== null && portions !== servings;
  const href = `/recipes/${recipeId}/cook${scaled ? `?${PORTIONS_PARAM}=${portions}` : ""}`;
  return (
    <ButtonLink href={href} className="flex-1 sm:flex-none">
      {children}
    </ButtonLink>
  );
}
