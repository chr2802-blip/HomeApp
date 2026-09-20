"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContextMenu, MenuItem } from "@/components/context-menu";
import { DialogForm } from "@/components/form-dialog";
import { Modal } from "@/components/modal";
import type { FormAction } from "@/lib/action-result";

/**
 * The standard menu on anything the app stores: edit it, delete it.
 *
 * Both sheets are owned here rather than inside the menu's panel, because the panel is
 * gone by the time either opens — an entry that carried its own dialog would take it
 * down with itself.
 *
 * Every action behind this menu acts on one record, so the id is given once and written
 * into both forms instead of each caller repeating the hidden field twice.
 */
export function ItemMenu({
  name,
  id,
  label,
  editTitle,
  editSubmitLabel = "Save changes",
  editAction,
  editLabel = "Edit",
  deleteTitle = "Are you sure?",
  deleteLabel = "Delete",
  deleteConfirmLabel = "Delete",
  deleteMessage,
  deleteAction,
  extraFields,
  extraItems,
  className = "",
  children,
}: {
  /** The form field both actions read the record's id from, e.g. "listId". */
  name: string;
  id: string;
  /** The record's own name, so a page full of menus says which is which. */
  label: string;
  editTitle?: string;
  editSubmitLabel?: string;
  /** Omitted where there is nothing to edit — a home is only ever deleted. */
  editAction?: FormAction;
  editLabel?: string;
  deleteTitle?: string;
  deleteLabel?: string;
  deleteConfirmLabel?: string;
  deleteMessage: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  /**
   * Hidden fields both actions need beyond the id — a member is named by their user and
   * the home they are in, because they may be in several.
   */
  extraFields?: React.ReactNode;
  /**
   * Entries for something the record can do besides being edited or deleted — "Add to
   * meal plan" on a recipe. Drawn between the two, so the destructive entry stays last
   * whatever else the menu carries.
   */
  extraItems?: React.ReactNode;
  className?: string;
  /** The edit form's fields. */
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <ContextMenu label={label} className={className}>
        {editAction && (
          <MenuItem icon="pencil" onSelect={() => setEditing(true)}>
            {editLabel}
          </MenuItem>
        )}
        {extraItems}
        <MenuItem icon="bin" tone="danger" onSelect={() => setConfirming(true)}>
          {deleteLabel}
        </MenuItem>
      </ContextMenu>

      {editAction && (
        <Modal open={editing} onClose={() => setEditing(false)} title={editTitle ?? editLabel}>
          <DialogForm
            action={editAction}
            submitLabel={editSubmitLabel}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          >
            <input type="hidden" name={name} value={id} />
            {extraFields}
            {children}
          </DialogForm>
        </Modal>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel={deleteConfirmLabel}
        action={deleteAction}
      >
        <input type="hidden" name={name} value={id} />
        {extraFields}
      </ConfirmDialog>
    </>
  );
}
