"use client";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/**
 * The sheet that asks before something irreversible happens, with the destructive
 * action's own form inside it.
 *
 * Unlike `ConfirmButton`, this one carries no trigger: it is opened by something that
 * is gone by then — an entry in a context menu, which closes as it is chosen. The form
 * lives inside the sheet, which is a portal, so nothing on the card behind it can be
 * submitted by mistake.
 */
export function ConfirmDialog({
  open,
  onClose,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  action,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden fields naming what the action acts on. */
  children?: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <form action={action} className="mt-5 flex gap-2">
        {children}
        <SubmitButton variant="danger" pendingLabel="Working…" className="flex-1 sm:flex-none">
          {confirmLabel}
        </SubmitButton>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </form>
    </Modal>
  );
}
