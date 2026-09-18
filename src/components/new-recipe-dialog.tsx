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
 * The "New recipe" button on the recipes page.
 *
 * A recipe can be started two ways — typed in from scratch, or pulled from a link
 * somebody found online — so the button asks which before showing either form, rather
 * than burying the link importer as one more field inside the create sheet where it
 * would be easy to miss and stranger to explain.
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

  function openFresh() {
    setStep("choose");
    setInitial(undefined);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function handleImported(recipe: ImportedRecipe) {
    setInitial(recipe);
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
                <Button type="button" variant="secondary" onClick={() => setStep("url")}>
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
              <RecipeImportField onImported={handleImported} />
            </ModalBody>
            <ModalFooter>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep("choose")}>
                  Back
                </Button>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
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
