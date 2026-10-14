"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createListCategory,
  deleteListCategory,
  moveListCategory,
  renameListCategory,
} from "@/app/actions/lists";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { Button, Input } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { LISTS } from "@/lib/copy/lists";

export type ListCategorySummary = {
  id: string;
  name: string;
  /** How many open items are under it — what deleting it would leave unsorted. */
  count: number;
};

const OPEN_EVENT = "list-categories:open";

/**
 * Opens the categories sheet from somewhere other than its own button — the list itself,
 * while it has no heading at all, because a list grouped by headings it does not have yet
 * is a list asking for exactly this.
 *
 * An event rather than a second sheet: the list's offer goes away the moment the first
 * heading exists, and a sheet drawn by it would close under the thumb adding that heading.
 */
export function SetUpCategoriesButton() {
  const say = sayIn(useLanguage());
  return (
    <Button type="button" variant="secondary" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {say(LISTS.setUpCategories)}
    </Button>
  );
}

/**
 * Where a list grouped by its own categories keeps them: the round control beside the
 * list's title, opening the sheet of this list's headings — add, rename, put in order,
 * delete. Only this list's: another list keeps its own (`ListCategory`).
 */
export function ListCategoriesButton({
  listId,
  categories,
}: {
  listId: string;
  categories: ListCategorySummary[];
}) {
  const say = sayIn(useLanguage());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label={say(LISTS.categories)}
        title={say(LISTS.categories)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="press-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      >
        {/* Three headings with a line under each: a list kept in sections. */}
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 5h7M4 12h7M4 19h7M14 5h6M14 12h6M14 19h6" strokeLinecap="round" />
        </svg>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={say(LISTS.categories)}>
        <ModalBody>
          <p className="mb-3 text-sm text-slate-500">{say(LISTS.categoriesHint)}</p>
          {categories.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              {say(LISTS.noCategories)}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {categories.map((category, index) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  first={index === 0}
                  last={index === categories.length - 1}
                />
              ))}
            </ul>
          )}
        </ModalBody>
        <ModalFooter>
          <AddCategory listId={listId} />
        </ModalFooter>
      </Modal>
    </>
  );
}

/** The add box, at the foot of the sheet where it stays in reach of a thumb. */
function AddCategory({ listId }: { listId: string }) {
  const say = sayIn(useLanguage());
  const { state, pending, handleSubmit } = useFormAction(createListCategory, {
    // Ready for the next one: headings are usually made several at a time.
    onSuccess: (form) => {
      form.reset();
      form.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    },
  });

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-1">
      <input type="hidden" name="listId" value={listId} />
      <div className="flex gap-2">
        <Input
          name="name"
          aria-label={say(LISTS.newCategory)}
          placeholder={say(LISTS.newCategoryPlaceholder)}
          required
          maxLength={60}
          autoComplete="off"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {say(LISTS.addCategory)}
        </Button>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

function CategoryRow({
  category,
  first,
  last,
}: {
  category: ListCategorySummary;
  first: boolean;
  last: boolean;
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const [, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(category.name);
  const [editing, setEditing] = useState(false);
  const { state, handleSubmit } = useFormAction(renameListCategory);

  // Another phone's rename landing, or this one's settling: adopted while nobody is typing.
  if (!editing && draft !== category.name && !(state && !state.ok)) setDraft(category.name);

  function send(action: (data: FormData) => Promise<void>, extra: Record<string, string> = {}) {
    const data = new FormData();
    data.set("categoryId", category.id);
    for (const [key, value] of Object.entries(extra)) data.set(key, value);
    startTransition(async () => {
      await action(data);
    });
  }

  if (confirming) {
    return (
      <li className="space-y-2 bg-red-50/50 px-3 py-3">
        <p className="text-sm text-slate-700">
          {category.count === 0
            ? say(LISTS.deleteEmptyCategoryMessage, { name: category.name })
            : say(LISTS.deleteCategoryMessage, { name: category.name, count: category.count })}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
            {say(APP.cancel)}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setConfirming(false);
              send(deleteListCategory);
            }}
          >
            {say(APP.delete)}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="px-2 py-1.5" data-category={category.name}>
      <div className="flex items-center gap-1">
        <form onSubmit={handleSubmit} className="min-w-0 flex-1">
          <input type="hidden" name="categoryId" value={category.id} />
          <input
            name="name"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={(event) => {
              setEditing(false);
              // Saved on leaving the box, as a list item's name is; blank is not a name.
              if (draft.trim() && draft.trim() !== category.name) event.currentTarget.form?.requestSubmit();
              else setDraft(category.name);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                setDraft(category.name);
              }
            }}
            aria-label={say(LISTS.categoryNameFor, { name: category.name })}
            maxLength={60}
            className="block w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none hover:border-slate-200 focus:border-[var(--accent)] focus:bg-white"
          />
        </form>
        <span className="shrink-0 px-1 text-xs tabular-nums text-slate-400" aria-hidden="true">
          {category.count}
        </span>
        <RowIcon
          label={say(LISTS.categoryUp, { name: category.name })}
          disabled={first}
          onClick={() => send(moveListCategory, { direction: "up" })}
          path="M12 19V5M6 11l6-6 6 6"
        />
        <RowIcon
          label={say(LISTS.categoryDown, { name: category.name })}
          disabled={last}
          onClick={() => send(moveListCategory, { direction: "down" })}
          path="M12 5v14M6 13l6 6 6-6"
        />
        <RowIcon
          label={say(LISTS.deleteCategory, { name: category.name })}
          danger
          onClick={() => setConfirming(true)}
          path="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12"
        />
      </div>
      {state && !state.ok && <p className="px-2 pb-1 text-xs text-red-600">{state.error}</p>}
    </li>
  );
}

function RowIcon({
  label,
  path,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  path: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`press-icon shrink-0 rounded-lg p-2 disabled:opacity-30 ${
        danger ? "text-slate-400 hover:text-red-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d={path} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
