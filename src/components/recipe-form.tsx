"use client";

import { Button, Card } from "@/components/ui";
import { RecipeFields, type RecipeValues } from "@/components/recipe-fields";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";

export function RecipeForm({
  action,
  recipe,
  submitLabel,
}: {
  action: FormAction;
  recipe?: RecipeValues;
  submitLabel: string;
}) {
  const { state, pending, handleSubmit } = useFormAction(action);

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {recipe?.id && <input type="hidden" name="recipeId" value={recipe.id} />}
        <RecipeFields recipe={recipe} />
        {state?.ok === false && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
