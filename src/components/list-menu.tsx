"use client";

import { useState } from "react";
import { MenuItem } from "@/components/context-menu";
import { DialogForm } from "@/components/form-dialog";
import { ItemMenu } from "@/components/item-menu";
import { Modal } from "@/components/modal";
import { Input, Label } from "@/components/ui";
import { duplicateList } from "@/app/actions/lists";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

/**
 * A list's three dots: the usual edit and delete, with "Duplicate" between them.
 *
 * "Duplicate" opens a sheet asking what the copy is called, then lands on the copy's own
 * page. The name is asked rather than invented, because a list nearly the same as another
 * is still a different list — "Packing, summer" beside "Packing, ski".
 *
 * The sheet is drawn here, beside `ItemMenu` rather than inside the entry, for the reason
 * `ItemMenu` owns its own sheets: the menu's panel unmounts once it has closed, and an
 * entry carrying its sheet took the sheet down with it a moment after it opened.
 */
export function ListMenu({
  listId,
  title,
  items,
  ...menu
}: { listId: string; title: string; items: number } & Omit<
  React.ComponentProps<typeof ItemMenu>,
  "name" | "id" | "label" | "extraItems"
>) {
  const [duplicating, setDuplicating] = useState(false);
  const say = sayIn(useLanguage());
  const inputId = `duplicate-${listId}`;

  return (
    <>
      <ItemMenu
        {...menu}
        name="listId"
        id={listId}
        label={title}
        extraItems={
          <MenuItem icon="copy" onSelect={() => setDuplicating(true)}>
            {say(LISTS.duplicateList)}
          </MenuItem>
        }
      />
      <Modal open={duplicating} onClose={() => setDuplicating(false)} title={say(LISTS.duplicateListTitle)}>
        <DialogForm
          action={duplicateList}
          submitLabel={say(LISTS.duplicateListSubmit)}
          onDone={() => setDuplicating(false)}
          onCancel={() => setDuplicating(false)}
        >
          <input type="hidden" name="listId" value={listId} />
          <div className="space-y-1">
            <Label htmlFor={inputId}>{say(LISTS.listName)}</Label>
            <Input
              id={inputId}
              name="title"
              defaultValue={say(LISTS.duplicateListName, { title })}
              required
              autoFocus
            />
          </div>
          {items > 0 && <p className="text-sm text-slate-500">{say(LISTS.duplicateListHint, { count: items })}</p>}
        </DialogForm>
      </Modal>
    </>
  );
}
