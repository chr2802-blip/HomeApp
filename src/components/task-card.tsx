"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContextMenu, MenuItem } from "@/components/context-menu";
import { SubmitButton } from "@/components/submit-button";
import type { FormAction } from "@/lib/action-result";

/**
 * One task, of either kind.
 *
 * Editing and deleting sit behind the three dots, as they do on every other card, and
 * pressing the card itself opens the same edit sheet — the shortcut for the thing the
 * menu is most often opened for. That leaves the face of the card for what is done most
 * often of all: saying the task is done.
 *
 * A finished one-off shows the way back instead. It is the same button in the same
 * place because it is the same thought a moment later — pressing Mark done on the wrong
 * card is the mistake this undoes, and hiding the undo behind the menu would make
 * finding it the hard part.
 *
 * `summary` is rendered by the page on the server; only the opening and closing needs a
 * browser.
 */
export function TaskCard({
  taskId,
  title,
  summary,
  photo,
  finished = false,
  updateAction,
  completeAction,
  reopenAction,
  deleteAction,
  children,
}: {
  taskId: string;
  title: string;
  /** Whether this is a one-off that has been done, and so offers a way back instead. */
  finished?: boolean;
  /** What the card shows when closed. */
  summary: React.ReactNode;
  /**
   * The task's picture, drawn beside the summary. Rendered by the page rather than
   * built here, for the same reason the summary is: only the opening and closing of
   * the sheet needs a browser.
   */
  photo?: React.ReactNode;
  updateAction: FormAction;
  completeAction: (formData: FormData) => void | Promise<void>;
  reopenAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  /** The edit form's fields. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-start">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pressable flex min-w-0 flex-1 items-start gap-3 px-5 py-4 text-left hover:bg-slate-50"
          >
            {photo}
            <div className="min-w-0 flex-1">{summary}</div>
          </button>
          {/* Beside the card's own button rather than inside it: a button cannot hold
              another, and opening the menu must not also open the edit sheet. */}
          <ContextMenu label={title} className="mt-3 mr-3">
            <MenuItem icon="pencil" onSelect={() => setOpen(true)}>
              Edit
            </MenuItem>
            <MenuItem icon="bin" tone="danger" onSelect={() => setConfirming(true)}>
              Delete
            </MenuItem>
          </ContextMenu>
        </div>

        {/* A sibling of the button rather than inside it: a form cannot live in a
            button, and marking a task done should not also open its sheet. */}
        <div className="border-t border-slate-100 px-5 py-3">
          <form action={finished ? reopenAction : completeAction}>
            <input type="hidden" name="taskId" value={taskId} />
            <SubmitButton variant="secondary" pendingLabel="Saving…">
              {finished ? "Reopen" : "Mark done"}
            </SubmitButton>
          </form>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit task">
        <DialogForm
          action={updateAction}
          submitLabel="Save changes"
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        >
          <input type="hidden" name="taskId" value={taskId} />
          {children}
        </DialogForm>
      </Modal>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        message={`Delete the task "${title}"?`}
        action={deleteAction}
      >
        <input type="hidden" name="taskId" value={taskId} />
      </ConfirmDialog>
    </>
  );
}
