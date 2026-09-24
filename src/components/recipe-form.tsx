"use client";

import type { HomeLanguage } from "@prisma/client";
import { AiOverlay, aiWaitActive } from "@/components/ai-overlay";
import { Button, Card } from "@/components/ui";
import {
  recipeSaveOverlay,
  RecipeFields,
  type CategoryOption,
  type RecipeValues,
} from "@/components/recipe-fields";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

export function RecipeForm({
  action,
  recipe,
  categories,
  submitLabel,
  language,
}: {
  action: FormAction;
  recipe?: RecipeValues;
  categories: CategoryOption[];
  submitLabel: string;
  language: HomeLanguage;
}) {
  const { state, pending, submitted, handleSubmit } = useFormAction(action);
  const wait = recipeSaveOverlay(language, recipe);
  const say = sayIn(language);

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {recipe?.id && <input type="hidden" name="recipeId" value={recipe.id} />}
        <RecipeFields recipe={recipe} categories={categories} language={language} />
        {state?.ok === false && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? say(RECIPES.saving) : submitLabel}
        </Button>
      </form>
      <AiOverlay active={aiWaitActive(wait, pending, submitted)} wait={wait} />
    </Card>
  );
}
