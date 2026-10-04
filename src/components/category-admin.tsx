import { FormDialog } from "@/components/form-dialog";
import type { FormAction } from "@/lib/action-result";

/**
 * The frame both of a home's sets of headings are kept in on `/settings` — the recipe
 * categories and the pantry's own shelves — so the two read and work the same way.
 *
 * The heading carries the green "+" that adds one, the way every page adds things,
 * rather than an always-open form above the list: the list is what an admin comes to
 * read ("what have we made?"), and a form standing over it every visit was most of the
 * section. Each row is the name, a line saying what is in it, and the three dots that
 * edit or delete it — never a field and a Save button per row, which on a phone was a
 * page of inputs nobody could tell apart from the names.
 */
export function CategorySection({
  title,
  intro,
  addLabel,
  addTitle,
  addSubmit,
  addAction,
  addFields,
  children,
}: {
  title: string;
  intro: string;
  addLabel: string;
  addTitle: string;
  addSubmit: string;
  addAction: FormAction;
  /** The add sheet's fields. */
  addFields: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase">{title}</h2>
        <FormDialog
          triggerShape="icon"
          triggerVariant="create"
          triggerLabel={addLabel}
          title={addTitle}
          submitLabel={addSubmit}
          action={addAction}
        >
          {addFields}
        </FormDialog>
      </div>
      <p className="mb-3 text-sm text-slate-500">{intro}</p>
      {children}
    </section>
  );
}

/** One heading in the list: a mark, its name, what is in it, and its menu. */
export function CategoryRow({
  name,
  detail,
  mark,
  menu,
}: {
  name: string;
  /** What is filed under it, in words — "12 recipes", "Empty". */
  detail: string;
  /** A short letter or glyph drawn on the home's tint. */
  mark: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" data-category-row={name}>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center accent-tint-bg rounded-xl text-sm font-semibold text-[var(--accent-text)]"
      >
        {mark}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-800">{name}</p>
        <p className="truncate text-xs text-slate-500">{detail}</p>
      </div>
      {menu}
    </div>
  );
}

/** The first letter of a name, as the row's mark. */
export function initialOf(name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
}
