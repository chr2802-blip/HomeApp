"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import type { FormAction } from "@/lib/action-result";

/**
 * One recurring task.
 *
 * The card is the way in: pressing it opens the task's own sheet, where editing and
 * deleting both live. That leaves the face of the card for the thing done most often —
 * saying the task is done — instead of spending a row on two buttons that are wanted
 * rarely.
 *
 * `summary` is rendered by the page on the server; only the opening and closing needs a
 * browser.
 */
export function TaskCard({
  taskId,
  title,
  summary,
  updateAction,
  completeAction,
  deleteAction,
  children,
}: {
  taskId: string;
  title: string;
  /** What the card shows when closed. */
  summary: React.ReactNode;
  updateAction: FormAction;
  completeAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  /** The edit form's fields. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card padded={false} className="overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="pressable block w-full px-5 py-4 text-left hover:bg-slate-50"
        >
          {summary}
        </button>

        {/* A sibling of the button rather than inside it: a form cannot live in a
            button, and marking a task done should not also open its sheet. */}
        <div className="border-t border-slate-100 px-5 py-3">
          <form action={completeAction}>
            <input type="hidden" name="taskId" value={taskId} />
            <SubmitButton variant="secondary" pendingLabel="Saving…">
              Mark done
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

        {/* Outside the edit form, because a form cannot be nested in another and the
            delete button has to submit the one it belongs to. Set apart below the rule
            so it is never the button reached for in a hurry. */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <form action={deleteAction}>
            <input type="hidden" name="taskId" value={taskId} />
            <ConfirmButton message={`Delete the recurring task "${title}"?`}>
              Delete task
            </ConfirmButton>
          </form>
        </div>
      </Modal>
    </>
  );
}
