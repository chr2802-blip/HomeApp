"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { importRecipeFromCaption, importRecipeFromUrl } from "@/app/actions/recipe-import";
import type { ImportedRecipe } from "@/lib/recipe-import";

/**
 * Fetches a recipe page and hands back what it found, so the cook is shown the usual
 * create form pre-filled rather than typing out what the site already wrote. It is its
 * own step rather than a field on the create form itself: fetching is a side trip that
 * may fail, and folding it into the same submit as saving would make one Save button
 * mean two different things.
 *
 * The title, ingredients, instructions, picture and total time come back filled in; the
 * categories are left for the create form either way, since those are this household's
 * own choices and schema.org has no standard place for them. A reel fills the video
 * link too, because there the link that was pasted *is* the video. The picture is only
 * ever a starting point, not a fixture — `PhotoField` shows it exactly as it would a
 * photo the cook chose themselves, replaceable or removable before saving.
 *
 * `autoFetchUrl` is a link `NewRecipeDialog` already found on the clipboard: it seeds
 * the field and starts the same fetch a press of the button would, once, on arrival —
 * a cook who copied a recipe's address specifically to paste it here should not have
 * to paste it by hand and press anything to prove it.
 *
 * `onNoRecipeFound` tells `NewRecipeDialog` when the page was reached but had nothing
 * to cook from — a shop page, a site with none of the markup this reads, a reel whose
 * description could not be got at — which is what puts a "Start from scratch" button
 * beside the error. A mistyped address or a page that would not load is worth trying
 * again as typed, so those do not trigger it; this one specifically means the link
 * itself was never going to work, which matters most when the clipboard skipped the
 * dialog straight to this step and there was no "choose" screen behind it.
 *
 * **The same failure opens the paste box below**, and that is the half of this feature
 * that cannot be blocked. A reel keeps its recipe in its caption and Instagram and
 * Facebook both refuse a signed-out request for one often enough that the automatic
 * read cannot be the only route — so the cook is offered the box rather than the news
 * that this app could not read what they are looking straight at. What they paste goes
 * through the very same parser, so a caption means one thing here however it arrived.
 *
 * The box is also there to be opened on purpose, under the link field, and not only
 * once something has gone wrong: a cook who has already had this reel refused once
 * knows how it ends, and making them watch two eight-second timeouts again to be handed
 * a box they were always going to use is the app being slow on principle.
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

  // The link travels with the caption: it is what makes the reel the recipe's video and
  // gives the poster frame an address to be fetched from, neither of which the pasted
  // text itself can say.
  function handleCaption() {
    if (!caption.trim()) {
      setError("Paste the reel's description first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("importCaption", caption);
      formData.set("importUrl", url.trim());
      const result = await importRecipeFromCaption(undefined, formData);
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
          A recipe page, or a reel from Instagram, Facebook or TikTok. Its title,
          ingredients, instructions, picture and time open in the usual form, to check over
          before saving.
        </p>
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
          />
          <p className="text-xs text-slate-500">
            The text under the video, with its ingredients and steps. It is read the same
            way a recipe page is, and the link above still becomes the recipe&rsquo;s video.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCaption}
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "Reading…" : "Read the description"}
          </Button>
        </div>
      )}
    </div>
  );
}
