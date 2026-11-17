"use client";

import { useState } from "react";
import { addRecipesToCategories, deleteRecipes } from "@/app/actions/recipes";
import { addRecipesIngredients } from "@/app/actions/lists";
import { Button } from "@/components/ui";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CategoryField } from "@/components/recipe-fields";
import { AddToListMenu, type ListChoice } from "@/components/add-to-list-menu";
import { useFormAction } from "@/components/use-form-action";
import { useSnackbar } from "@/components/snackbar";
import { useLanguage } from "@/components/language-provider";
import { RECIPE_IDS_FIELD } from "@/lib/recipes";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { APP } from "@/lib/copy/app";

/** One of the bar's four: an icon over a short word, white on the bar's dark. */
const BAR_BUTTON =
  "press-button flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium text-white hover:bg-white/10 disabled:opacity-40 [&_svg]:h-5 [&_svg]:w-5";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * What the recipe list can do to the recipes chosen on it, in a small bar at the bottom of
 * the screen: delete them, file them under categories, put them on a list, or stop
 * choosing. Choosing starts by pressing and holding a card (`RecipeDirectory`).
 *
 * It floats just above the tab bar (`app-above-bar`), where the thumb already is, and
 * `data-choosing` stands the page's "+" down while it is there (globals.css) — the bar
 * sits where the "+" floats once the tab bar has scrolled away.
 *
 * Every action leaves choosing once it has done its work. Filing only ever adds headings
 * (`addRecipesToCategories`), so the sheet starts with nothing ticked.
 */
export function RecipeSelectionBar({
  chosen,
  categories,
  lists,
  onDone,
}: {
  chosen: string[];
  categories: { id: string; name: string }[];
  lists: ListChoice[];
  /** Leaves choosing: Cancel, or any action that worked. */
  onDone: () => void;
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const notify = useSnackbar();
  const [filing, setFiling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const none = chosen.length === 0;

  // Said from here, as a snack, because the bar goes the moment the press succeeds.
  const { state, pending, handleSubmit } = useFormAction(
    async (previous, formData) => {
      const result = await addRecipesToCategories(previous, formData);
      if (result?.ok && result.note) notify(result.note);
      return result;
    },
    {
      onSuccess: () => {
        setFiling(false);
        onDone();
      },
    },
  );

  return (
    <>
      <div
        data-choosing
        className="app-above-bar fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4"
      >
        <div className="w-full max-w-md rounded-2xl bg-slate-900 p-1.5 shadow-lg">
          <p className="px-2 pt-1 pb-1.5 text-center text-xs font-medium text-slate-300" aria-live="polite">
            {say(RECIPES.bulkSelected, { count: chosen.length })}
          </p>
          <div className="flex items-stretch gap-1">
            <button type="button" disabled={none} onClick={() => setDeleting(true)} className={BAR_BUTTON}>
              <Glyph d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
              {say(APP.delete)}
            </button>
            <button type="button" disabled={none} onClick={() => setFiling(true)} className={BAR_BUTTON}>
              <Glyph d="M4 7.5h7l2 2.5h7v8.5H4zM12 12.5v4M10 14.5h4" />
              {say(RECIPES.bulkAddCategory)}
            </button>
            <AddToListMenu
              sheet
              lists={lists}
              action={addRecipesIngredients}
              extraData={{ [RECIPE_IDS_FIELD]: chosen.join(",") }}
              triggerClassName={BAR_BUTTON}
              disabled={none}
              onAdded={onDone}
            />
            <button type="button" onClick={onDone} className={BAR_BUTTON}>
              <Glyph d="M6 6l12 12M18 6L6 18" />
              {say(APP.cancel)}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        message={say(RECIPES.bulkDeleteMessage, { count: chosen.length })}
        action={async (formData) => {
          await deleteRecipes(formData);
          setDeleting(false);
          onDone();
        }}
      >
        {chosen.map((id) => (
          <input key={id} type="hidden" name={RECIPE_IDS_FIELD} value={id} />
        ))}
      </ConfirmDialog>

      <Modal open={filing} onClose={() => setFiling(false)} title={say(RECIPES.bulkSheetTitle)}>
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
              <Button type="button" variant="secondary" onClick={() => setFiling(false)}>
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
