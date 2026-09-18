"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  RecipeFields,
  type CategoryOption,
  type RecipeValues,
} from "@/components/recipe-fields";
import { RecipeImportField } from "@/components/recipe-import-field";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";
import type { ImportedRecipe } from "@/lib/recipe-import";

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
  const [values, setValues] = useState(recipe);
  // RecipeFields' inputs are uncontrolled, so a fetched import cannot just set their
  // value — it has to remount them with new defaultValues, which changing this key does.
  const [importKey, setImportKey] = useState(0);

  function handleImported(imported: ImportedRecipe) {
    setValues((current) => ({ ...current, ...imported }));
    setImportKey((key) => key + 1);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {recipe?.id && <input type="hidden" name="recipeId" value={recipe.id} />}
        {/* Only when writing a new recipe — editing one already has everything an
            import would overwrite. */}
        {!recipe?.id && <RecipeImportField onImported={handleImported} />}
        <RecipeFields key={importKey} recipe={values} categories={categories} />
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
