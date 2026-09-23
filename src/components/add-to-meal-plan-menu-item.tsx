"use client";

import { useTransition } from "react";
import { MenuItem } from "@/components/context-menu";
import { addRecipeToNextOpenDay } from "@/app/actions/meals";
import { tick } from "@/lib/haptics";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { MEALS } from "@/lib/copy/meals";

/**
 * "Add to meal plan" inside a recipe's own three-dot menu: it books the recipe onto the
 * next day nothing is planned for yet, without asking which — the calendar answers that,
 * the way "Add to list" answers which list from the ones that track amounts.
 *
 * Built as a form-data function called in a transition rather than a `<form>`, for the
 * same reason `SnoozeMenuItem` is: the panel is a portal and closes the moment an entry
 * is chosen, gone before a form inside it could be submitted. The buzz is the only
 * feedback a press here gets — the effect lands on `/meals`, a tab away, so there is
 * nothing on this screen for a status line to update.
 */
export function AddToMealPlanMenuItem({ recipeId }: { recipeId: string }) {
  const [, startTransition] = useTransition();
  const say = sayIn(useLanguage());

  return (
    <MenuItem
      icon="clock"
      onSelect={() => {
        tick();
        const data = new FormData();
        data.set("recipeId", recipeId);
        startTransition(async () => {
          await addRecipeToNextOpenDay(data);
        });
      }}
    >
      {say(MEALS.addToMealPlan)}
    </MenuItem>
  );
}
