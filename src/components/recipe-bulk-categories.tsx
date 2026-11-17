"use client";

import { useState } from "react";
import { addRecipesToCategories } from "@/app/actions/recipes";
import { Button } from "@/components/ui";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { CategoryField } from "@/components/recipe-fields";
import { useFormAction } from "@/components/use-form-action";
import { useSnackbar } from "@/components/snackbar";
import { useLanguage } from "@/components/language-provider";
import { RECIPE_IDS_FIELD } from "@/lib/recipes";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { APP } from "@/lib/copy/app";

/**
 * The bar the recipe list shows while recipes are being chosen, and the sheet behind its
 * "Add category": how a household files a whole collection under a heading in one press
 * rather than one recipe's edit sheet at a time.
 *
 * It floats just above the tab bar (`app-above-bar`), where the thumb already is, and
 * says how many are chosen. Adding only ever adds (`addRecipesToCategories`): every recipe
 * keeps the headings it had, so the sheet starts with nothing ticked.
 */
export function BulkCategoryBar({
  chosen,
  categories,
  onDone,
}: {
  chosen: string[];
  categories: { id: string; name: string }[];
  /** Called once the recipes are filed, so the list can leave choosing. */
  onDone: () => void;
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const notify = useSnackbar();
  const [open, setOpen] = useState(false);
  // The note says how many were filed, as a snack — said from here, because the bar
  // itself goes the moment the press succeeds and could not say it afterwards.
  const { state, pending, handleSubmit } = useFormAction(async (previous, formData) => {
    const result = await addRecipesToCategories(previous, formData);
    if (result?.ok && result.note) notify(result.note);
    return result;
  }, {
    onSuccess: () => {
      setOpen(false);
      onDone();
    },
  });

  return (
    <>
      <div data-choosing className="app-above-bar fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4">
        <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 py-2 pr-2 pl-4 text-white shadow-lg">
          <span className="min-w-0 flex-1 truncate text-sm font-medium" aria-live="polite">
            {say(RECIPES.bulkSelected, { count: chosen.length })}
          </span>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            disabled={chosen.length === 0}
            className="shrink-0"
          >
            {say(RECIPES.bulkAddCategory)}
          </Button>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={say(RECIPES.bulkSheetTitle)}>
        <form onSubmit={handleSubmit} className="relative flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-3">
            <p className="text-sm text-slate-600">
              {say(RECIPES.bulkSelected, { count: chosen.length })} · {say(RECIPES.bulkSheetHint)}
            </p>
            {chosen.map((id) => (
              <input key={id} type="hidden" name={RECIPE_IDS_FIELD} value={id} />
            ))}
            <CategoryField categories={categories} language={language} />
          </ModalBody>
          <ModalFooter>
            {state?.ok === false && (
              <p role="alert" className="mb-3 text-sm text-red-600">
                {state.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {say(APP.cancel)}
              </Button>
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {say(RECIPES.bulkSave)}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
