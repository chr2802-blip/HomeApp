"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { importRecipeFromCaption, importRecipeFromUrl } from "@/app/actions/recipe-import";
import type { ImportedRecipe } from "@/lib/recipe-import";

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
 * thing, which matters most when the clipboard skipped the dialog straight to this step and
 * there was no "choose" screen behind it.
 *
 * **The same failure opens the paste box below**, and that is the half of this feature that
 * cannot be blocked. Instagram and Facebook both refuse a signed-out request often enough
 * that the automatic read cannot be the only route, and the reading itself can be down —
 * so the cook is offered the box rather than the news that this app could not read what
 * they are looking straight at. What they paste goes to the very same reader, so a
 * description means one thing here however it arrived.
 *
 * The box is also there to be opened on purpose, under the link field, and not only once
 * something has gone wrong: a cook who has already had this reel refused once knows how it
 * ends, and making them watch two eight-second timeouts again to be handed a box they were
 * always going to use is the app being slow on principle.
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
  const [caption, setCaption] = useState("");
  const [showCaption, setShowCaption] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which of the two round trips is in flight, so the one status block below can say
  // something more specific than "pending" — reading a page and reading a pasted
  // caption take the same shape of time but are not the same wait to describe.
  const [stage, setStage] = useState<"idle" | "fetching" | "reading">("idle");
  const [pending, startTransition] = useTransition();

  function setFetchError(message: string | null, notARecipe = false) {
    setError(message);
    // The box stays open once it has been opened: a cook who pasted a caption and had
    // it refused is mid-paste, and taking the field away under them would lose it.
    if (notARecipe) setShowCaption(true);
    onNoRecipeFound?.(notARecipe);
  }

  function handleFetch(overrideUrl?: string) {
    const trimmed = (overrideUrl ?? url).trim();
    if (!trimmed) {
      setFetchError("Paste a link to a recipe first.");
      return;
    }

    setFetchError(null);
    setStage("fetching");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("importUrl", trimmed);
      const result = await importRecipeFromUrl(undefined, formData);
      setStage("idle");
      if (result.ok) {
        onImported(result.recipe);
        setUrl("");
      } else {
        setFetchError(result.error, result.notARecipe);
      }
    });
  }

  // The link travels with the caption: it is what makes the reel the recipe's video and
  // gives the poster frame an address to be fetched from, neither of which the pasted
  // text itself can say.
  function handleCaption() {
    if (!caption.trim()) {
      setError("Paste the reel's description first.");
      return;
    }

    setError(null);
    setStage("reading");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("importCaption", caption);
      formData.set("importUrl", url.trim());
      const result = await importRecipeFromCaption(undefined, formData);
      setStage("idle");
      if (result.ok) onImported(result.recipe);
      else setError(result.error);
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
        <Label htmlFor="importUrl">Recipe link</Label>
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
            aria-busy={pending}
          >
            {pending && <Spinner />}
            {stage === "fetching" ? "Fetching…" : "Fetch"}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          A recipe page, or a reel from Instagram, Facebook or TikTok. Its title,
          ingredients, instructions, picture and time open in the usual form, tidied up and
          ready to check over before saving.
        </p>
        {/*
          A page fetch plus the AI writing the recipe up can run well past what a button's
          own label reads as "still working" — so this is not that label said twice, it is
          the thing to look at instead of it: bigger, worded per stage, and the one part of
          the step that keeps moving for as long as the wait does.
        */}
        {pending && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <Spinner className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                {stage === "reading" ? "Reading the description…" : "Reading the recipe…"}
              </p>
              <p className="text-xs text-slate-500">
                The AI is writing it up — this can take up to 20 seconds.
              </p>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {!showCaption && (
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-sm"
            onClick={() => setShowCaption(true)}
            disabled={pending}
          >
            Paste the description instead
          </Button>
        )}
      </div>

      {showCaption && (
        <div className="space-y-1 border-t border-slate-200 pt-4">
          <Label htmlFor="importCaption">Paste the description instead</Label>
          <Textarea
            id="importCaption"
            rows={6}
            placeholder={"Ingredienser\n200 g mel\n2 æg\n\nFremgangsmåde\nRør det hele sammen."}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            disabled={pending}
          />
          <p className="text-xs text-slate-500">
            The text under the video, with its ingredients and steps. It is read by the same
            thing that reads a recipe page, and the link above still becomes the
            recipe&rsquo;s video.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCaption}
            disabled={pending}
            aria-busy={pending}
          >
            {pending && <Spinner />}
            {stage === "reading" ? "Reading…" : "Read the description"}
          </Button>
        </div>
      )}
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
