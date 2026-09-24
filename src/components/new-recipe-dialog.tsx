"use client";

import { useState } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { Button, IconButton } from "@/components/ui";
import {
  recipeSaveOverlay,
  RecipeFields,
  type CategoryOption,
  type RecipeValues,
} from "@/components/recipe-fields";
import { RecipeImportField } from "@/components/recipe-import-field";
import type { FormAction } from "@/lib/action-result";
import type { ImportedRecipe } from "@/lib/recipe-import";
import { useLanguage } from "@/components/language-provider";
import { sayIn, type Say } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";

type Step = "choose" | "url" | "form";

function titleFor(step: Step, say: Say): string {
  return step === "url" ? say(RECIPES.importFromLink) : say(RECIPES.newRecipe);
}

/**
 * How long the clipboard is given to answer before the button stops waiting for it.
 *
 * A browser that will not say is not always a browser that says so: `readText()` can
 * sit unresolved behind a permission decision nobody is going to make, and the link
 * step opens *after* this check — so a promise that never settles is an "Import from a
 * link" button that does nothing at all, with no error and nothing to see. Short enough
 * that the step still opens at the speed of a press, long enough for a browser that is
 * simply going to answer.
 */
const CLIPBOARD_GRACE_MS = 500;

/**
 * A recipe link the cook already had on their clipboard when they chose "Import from a
 * link", or null for everything that is not that — nothing copied, a browser that
 * refuses to say, a browser that never gets round to saying, or text that is not a web
 * address. All of those get the same answer: ask, the way the link step always has.
 */
async function clipboardRecipeUrl(): Promise<string | null> {
  try {
    if (!navigator.clipboard?.readText) return null;

    const text = await Promise.race([
      navigator.clipboard.readText(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CLIPBOARD_GRACE_MS)),
    ]);
    if (text === null) return null;

    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? text.trim() : null;
  } catch {
    // Not a URL, or the browser would not say — Safari has no readText at all, and
    // Chrome can refuse without asking if the page is not in focus. Either way this is
    // exactly the case the button already handled: nothing to prefill.
    return null;
  }
}

/**
 * The "New recipe" button on the recipes page.
 *
 * A recipe can be started two ways — typed in from scratch, or pulled from a link
 * somebody found online — so the button always asks which first, rather than burying
 * the link importer as one more field inside the create sheet where it would be easy to
 * miss and stranger to explain. A cook who copied a recipe's link specifically to paste
 * it here is not asked to paste it by hand, though: choosing "Import from a link" itself
 * reads the clipboard, and a page's own address goes straight to fetching it.
 *
 * The choice resets on every open rather than on close: resetting on close would show
 * it flashing back to "choose" while the sheet is still animating away.
 */
export function NewRecipeDialog({
  categories,
  action,
}: {
  categories: CategoryOption[];
  action: FormAction;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [initial, setInitial] = useState<RecipeValues | undefined>(undefined);
  const [autoUrl, setAutoUrl] = useState<string | undefined>(undefined);
  const [noRecipeFound, setNoRecipeFound] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const language = useLanguage();
  const say = sayIn(language);

  function openFresh() {
    setInitial(undefined);
    setNoRecipeFound(false);
    setNote(null);
    setAutoUrl(undefined);
    setStep("choose");
    setOpen(true);
  }

  // The clipboard check runs before the link step opens rather than after, so it never
  // shows the field empty for a moment only to jump straight past it once the check
  // resolves.
  async function openImportFromLink() {
    const pasted = await clipboardRecipeUrl();
    setAutoUrl(pasted ?? undefined);
    setStep("url");
  }

  function close() {
    setOpen(false);
  }

  function handleImported(recipe: ImportedRecipe) {
    setInitial(recipe);
    setNote(recipe.note);
    setStep("form");
  }

  // A link that will not import — a reel, a shop page, anything without a recipe to
  // read — must not be a dead end: this is the way back to the plain form once the
  // clipboard's own guess has failed.
  function startFromScratch() {
    setInitial(undefined);
    setNote(null);
    setStep("form");
  }

  return (
    <>
      <IconButton variant="create" label={say(RECIPES.newRecipe)} onClick={openFresh}>
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>

      <Modal open={open} onClose={close} title={titleFor(step, say)}>
        {step === "choose" && (
          <>
            <ModalBody>
              <p className="text-sm text-slate-600">{say(RECIPES.chooseHint)}</p>
            </ModalBody>
            <ModalFooter>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={() => setStep("form")}>
                  {say(RECIPES.startFromScratch)}
                </Button>
                <Button type="button" variant="secondary" onClick={openImportFromLink}>
                  {say(RECIPES.importFromLink)}
                </Button>
                <Button type="button" variant="ghost" onClick={close}>
                  {say(RECIPES.cancel)}
                </Button>
              </div>
            </ModalFooter>
          </>
        )}

        {step === "url" && (
          <>
            <ModalBody>
              <RecipeImportField
                onImported={handleImported}
                onNoRecipeFound={setNoRecipeFound}
                autoFetchUrl={autoUrl}
              />
            </ModalBody>
            <ModalFooter>
              <div className="flex flex-col gap-2">
                {noRecipeFound && (
                  <Button type="button" onClick={startFromScratch}>
                    {say(RECIPES.startFromScratchInstead)}
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setStep("choose")}>
                    {say(RECIPES.back)}
                  </Button>
                  <Button type="button" variant="ghost" onClick={close}>
                    {say(RECIPES.cancel)}
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </>
        )}

        {step === "form" && (
          <DialogForm
            action={action}
            submitLabel={say(RECIPES.saveRecipe)}
            onDone={close}
            onCancel={close}
            overlay={recipeSaveOverlay(language, initial)}
          >
            {/*
              What the import thought was worth a second look — a description that stopped
              mid-sentence, amounts it sent the reader to a link for. It sits above the
              fields rather than beside one because it is about the recipe as a whole, and
              it is amber rather than red: nothing is wrong yet, and the form below is
              already the step where it gets checked.
            */}
            {note && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {say(RECIPES.worthChecking, { note })}
              </p>
            )}
            <RecipeFields recipe={initial} categories={categories} language={language} />
          </DialogForm>
        )}
      </Modal>
    </>
  );
}
