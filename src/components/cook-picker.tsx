"use client";

import { useState } from "react";

import { Modal, ModalBody } from "@/components/modal";
import { Input } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { MEALS } from "@/lib/copy/meals";

export type CookChoice = { id: string; title: string };

/**
 * Putting a second recipe on the stove from inside the first one.
 *
 * Without it, cooking two things meant closing the one, going back through the recipes
 * and opening the other — three screens with a pan on the heat. What is already on the
 * stove comes first, because going back to it is the commonest reason to open this; then
 * whatever the meal plan says tonight is, since the second dish is usually the side that
 * goes with it; then every recipe, narrowed by typing. A recipe appears once, in the first
 * group that has it, so the groups are a partition rather than views of the same list.
 *
 * The search box does not take the focus, for the same reason the meal picker's does not:
 * a keyboard sliding up over the list is the list hidden behind something nobody asked
 * for.
 */
export function CookPicker({
  open,
  onClose,
  currentId,
  cooking,
  tonightId,
  recipes,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  currentId: string;
  /** The other recipes on the stove, in the order they were put on it. */
  cooking: CookChoice[];
  tonightId: string | null;
  recipes: CookChoice[];
  onPick: (recipeId: string) => void;
}) {
  const say = sayIn(useLanguage());
  const [query, setQuery] = useState("");

  const needle = query.trim().toLocaleLowerCase();
  const matches = (choice: CookChoice) => !needle || choice.title.toLocaleLowerCase().includes(needle);
  const taken = new Set([currentId, ...cooking.map((choice) => choice.id)]);
  const tonight = recipes.find((recipe) => recipe.id === tonightId && !taken.has(recipe.id));
  if (tonight) taken.add(tonight.id);

  const groups = [
    { heading: say(RECIPES.stillCooking), choices: cooking.filter(matches) },
    { heading: say(RECIPES.tonightOnPlan), choices: tonight && matches(tonight) ? [tonight] : [] },
    { heading: say(MEALS.allRecipes), choices: recipes.filter((recipe) => !taken.has(recipe.id) && matches(recipe)) },
  ].filter((group) => group.choices.length > 0);

  return (
    <Modal open={open} onClose={onClose} title={say(RECIPES.cookAnotherTitle)}>
      <div className="shrink-0 border-b border-slate-100 px-5 py-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={say(RECIPES.searchRecipesAria)}
          aria-label={say(RECIPES.searchRecipesAria)}
        />
      </div>
      <ModalBody className="space-y-5">
        {groups.length === 0 && <p className="text-sm text-slate-500">{say(RECIPES.noRecipesMatch)}</p>}
        {groups.map((group) => (
          <section key={group.heading}>
            <h3 className="mb-2 text-xs font-semibold text-slate-500 uppercase">{group.heading}</h3>
            <ul className="divide-y divide-slate-100">
              {group.choices.map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    onClick={() => onPick(choice.id)}
                    className="pressable w-full py-3 text-left text-base break-words active:scale-[0.99]"
                  >
                    {choice.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </ModalBody>
    </Modal>
  );
}
