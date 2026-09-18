"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { importRecipeFromUrl } from "@/app/actions/recipe-import";
import type { ImportedRecipe } from "@/lib/recipe-import";

/**
 * Fills the rest of the form from a recipe page's own link, rather than the cook
 * retyping what the site already wrote out. Its own input and button rather than a
 * field on the recipe's own form: fetching is a side trip that may fail, and folding it
 * into the same submit as saving would make one Save button mean two different things.
 *
 * What comes back replaces the title, ingredients and instructions and nothing else —
 * the picture, the video link and the categories are this household's own choices, not
 * something to overwrite from outside.
 */
export function RecipeImportField({
  onImported,
}: {
  onImported: (recipe: ImportedRecipe) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFetch() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a link to a recipe first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("importUrl", trimmed);
      const result = await importRecipeFromUrl(undefined, formData);
      if (result.ok) {
        onImported(result.recipe);
        setUrl("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-1 rounded-lg border border-dashed border-slate-300 p-3">
      <Label htmlFor="importUrl">Import from a link</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="importUrl"
          type="url"
          placeholder="https://www.example.com/recipe/..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="min-w-48 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleFetch}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "Fetching…" : "Fetch"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Paste a link to a recipe page to fill in the title, ingredients and instructions below —
        check them over before saving.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
