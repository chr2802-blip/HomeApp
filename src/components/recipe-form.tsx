"use client";

import { AiOverlay } from "@/components/ai-overlay";
import { Button, Card } from "@/components/ui";
import {
  RECIPE_SAVE_OVERLAY,
  RecipeFields,
  type CategoryOption,
  type RecipeValues,
} from "@/components/recipe-fields";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";

export function RecipeForm({
  action,
  recipe,
  categories,
  submitLabel,
}: {
  action: FormAction;
  recipe?: RecipeValues;
  categories: CategoryOption[];
  submitLabel: string;
}) {
  const { state, pending, handleSubmit } = useFormAction(action);

  return (
    <Card className="relative overflow-hidden">
      <form onSubmit={handleSubmit} className="space-y-4">
        {recipe?.id && <input type="hidden" name="recipeId" value={recipe.id} />}
        <RecipeFields recipe={recipe} categories={categories} />
        {state?.ok === false && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </form>
      <AiOverlay active={pending} {...RECIPE_SAVE_OVERLAY} />
    </Card>
  );
}
