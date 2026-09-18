"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { importRecipeFromUrl } from "@/app/actions/recipe-import";
import type { ImportedRecipe } from "@/lib/recipe-import";

/**
 * Fetches a recipe page and hands back what it found, so the cook is shown the usual
 * create form pre-filled rather than typing out what the site already wrote. It is its
 * own step rather than a field on the create form itself: fetching is a side trip that
 * may fail, and folding it into the same submit as saving would make one Save button
 * mean two different things.
 *
 * The title, ingredients, instructions and picture come back filled in; the video link
 * and categories are left for the create form either way, since those are this
 * household's own choices and schema.org has no standard place for either. The picture
 * is only ever a starting point, not a fixture — `PhotoField` shows it exactly as it
 * would a photo the cook chose themselves, replaceable or removable before saving.
 *
 * `autoFetchUrl` is a link `NewRecipeDialog` already found on the clipboard: it seeds
 * the field and starts the same fetch a press of the button would, once, on arrival —
 * a cook who copied a recipe's address specifically to paste it here should not have
 * to paste it by hand and press anything to prove it.
 */
export function RecipeImportField({
  onImported,
  autoFetchUrl,
}: {
  onImported: (recipe: ImportedRecipe) => void;
  autoFetchUrl?: string;
}) {
  const [url, setUrl] = useState(autoFetchUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFetch(overrideUrl?: string) {
    const trimmed = (overrideUrl ?? url).trim();
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

  // Once only, for the address this field was seeded with — never for one typed or
  // edited afterward, and there is nothing else `autoFetchUrl` could mean once this
  // component already exists: `NewRecipeDialog` mounts a fresh one for every visit to
  // this step, so it never changes under a component that is already showing something.
  useEffect(() => {
    if (autoFetchUrl) handleFetch(autoFetchUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1">
      <Label htmlFor="importUrl">Recipe link</Label>
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
          onClick={() => handleFetch()}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "Fetching…" : "Fetch"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Its title, ingredients, instructions and picture open in the usual form, to check over
        before saving.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
