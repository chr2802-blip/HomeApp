"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, Label } from "@/components/ui";
import { importRecipeFromUrl } from "@/app/actions/recipe-import";
import type { ImportedRecipe } from "@/lib/recipe-import";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

/**
 * Fetches a recipe and hands back what it found, so the cook is shown the usual create
 * form pre-filled rather than typing out what the page already wrote. It is its own step
 * rather than a field on the create form itself: fetching is a side trip that may fail, and
 * folding it into the same submit as saving would make one Save button mean two different
 * things.
 *
 * The title, ingredients, instructions, picture and total time come back filled in; the
 * categories are left for the create form either way, since those are this household's own
 * choices and no page publishes them. A reel fills the video link too, because there the
 * link that was pasted *is* the video. The picture is only ever a starting point, not a
 * fixture — `PhotoField` shows it exactly as it would a photo the cook chose themselves,
 * replaceable or removable before saving.
 *
 * `autoFetchUrl` is a link `NewRecipeDialog` already found on the clipboard: it seeds the
 * field and starts the same fetch a press of the button would, once, on arrival — a cook
 * who copied a recipe's address specifically to paste it here should not have to paste it
 * by hand and press anything to prove it.
 *
 * `onNoRecipeFound` tells `NewRecipeDialog` when there is nothing more to try with the link
 * as typed — a shop page, a reel whose description could not be got at, a reading that
 * could not be done — which is what puts a "Start from scratch" button beside the error. A
 * mistyped address or a page that would not load is worth trying again as typed, so those
 * do not trigger it; this one specifically means pressing Fetch again will do the same
 * thing.
 */
export function RecipeImportField({
  onImported,
  onNoRecipeFound,
  autoFetchUrl,
}: {
  onImported: (recipe: ImportedRecipe) => void;
  onNoRecipeFound?: (found: boolean) => void;
  autoFetchUrl?: string;
}) {
  const [url, setUrl] = useState(autoFetchUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const say = sayIn(useLanguage());

  function setFetchError(message: string | null, notARecipe = false) {
    setError(message);
    onNoRecipeFound?.(notARecipe);
  }

  function handleFetch(overrideUrl?: string) {
    const trimmed = (overrideUrl ?? url).trim();
    if (!trimmed) {
      setFetchError(say(RECIPES.pasteLinkFirst));
      return;
    }

    setFetchError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("importUrl", trimmed);
      const result = await importRecipeFromUrl(undefined, formData);
      if (result.ok) {
        onImported(result.recipe);
        setUrl("");
      } else {
        setFetchError(result.error, result.notARecipe);
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
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="importUrl">{say(RECIPES.recipeLink)}</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="importUrl"
            type="url"
            placeholder="https://www.example.com/recipe/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={pending}
            className="min-w-48 flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleFetch()}
            disabled={pending}
          >
            {pending ? say(RECIPES.fetching) : say(RECIPES.fetch)}
          </Button>
        </div>
        <p className="text-xs text-slate-500">{say(RECIPES.linkHint)}</p>
        {/*
          A page fetch plus the AI writing the recipe up can run well past what a button's
          own label reads as "still working" — so this is the one place a spinner shows: it
          is bigger, worded, and the part of the step that keeps moving for as long as the
          wait does.
        */}
        {pending && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <Spinner className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">{say(RECIPES.reading)}</p>
              <p className="text-xs text-slate-500">{say(RECIPES.readingHint)}</p>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`animate-spin ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}
