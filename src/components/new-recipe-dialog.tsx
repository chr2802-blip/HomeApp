"use client";

import { useState } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { Button, IconButton } from "@/components/ui";
import { RecipeFields, type CategoryOption, type RecipeValues } from "@/components/recipe-fields";
import { RecipeImportField } from "@/components/recipe-import-field";
import type { FormAction } from "@/lib/action-result";
import type { ImportedRecipe } from "@/lib/recipe-import";

type Step = "choose" | "url" | "form";

const TITLES: Record<Step, string> = {
  choose: "New recipe",
  url: "Import from a link",
  form: "New recipe",
};

/**
 * How long the clipboard is given to answer before the button stops waiting for it.
 *
 * A browser that will not say is not always a browser that says so: `readText()` can
 * sit unresolved behind a permission decision nobody is going to make, and the sheet
 * opens *after* this check — so a promise that never settles is a "New recipe" button
 * that does nothing at all, with no error and nothing to see. Short enough that the
 * sheet still opens at the speed of a press, long enough for a browser that is simply
 * going to answer.
 */
const CLIPBOARD_GRACE_MS = 500;

/**
 * A recipe link the cook already had on their clipboard when they pressed the button,
 * or null for everything that is not that — nothing copied, a browser that refuses to
 * say, a browser that never gets round to saying, or text that is not a web address.
 * All of those get the same answer: ask, the way the button always has.
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
 * somebody found online — so the button asks which before showing either form, rather
 * than burying the link importer as one more field inside the create sheet where it
 * would be easy to miss and stranger to explain. A cook who copied a recipe's link
 * specifically to paste it here is not asked, though: the button reads the clipboard
 * itself, and a page's own address goes straight to fetching it, skipping both the
 * question and the paste.
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

  // The clipboard check runs before the sheet opens rather than after, so it never
  // shows "choose" for a moment only to jump straight past it once the check resolves.
  async function openFresh() {
    setInitial(undefined);
    setNoRecipeFound(false);
    const pasted = await clipboardRecipeUrl();
    setAutoUrl(pasted ?? undefined);
    setStep(pasted ? "url" : "choose");
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function handleImported(recipe: ImportedRecipe) {
    setInitial(recipe);
    setStep("form");
  }

  // A link that will not import — a reel, a shop page, anything without a recipe to
  // read — must not be a dead end just because the clipboard skipped straight past the
  // "choose" screen that would otherwise offer this.
  function startFromScratch() {
    setInitial(undefined);
    setStep("form");
  }

  return (
    <>
      <IconButton variant="create" label="New recipe" onClick={openFresh}>
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

      <Modal open={open} onClose={close} title={TITLES[step]}>
        {step === "choose" && (
          <>
            <ModalBody>
              <p className="text-sm text-slate-600">
                Type it in yourself, or pull the title, ingredients and instructions from a
                link.
              </p>
            </ModalBody>
            <ModalFooter>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={() => setStep("form")}>
                  Start from scratch
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  // Chosen by hand rather than found on the clipboard: starts blank,
                  // even if openFresh found something there earlier this same visit.
                  onClick={() => {
                    setAutoUrl(undefined);
                    setStep("url");
                  }}
                >
                  Import from a link
                </Button>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
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
                    Start from scratch instead
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setStep("choose")}>
                    Back
                  </Button>
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </>
        )}

        {step === "form" && (
          <DialogForm action={action} submitLabel="Save recipe" onDone={close} onCancel={close}>
            <RecipeFields recipe={initial} categories={categories} />
          </DialogForm>
        )}
      </Modal>
    </>
  );
}
