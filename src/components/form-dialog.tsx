"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";

export function DialogSubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className="flex-1 sm:flex-none">
      {pending && (
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 animate-spin"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
        </svg>
      )}
      {pending ? "Saving…" : label}
    </Button>
  );
}

const ICONS = {
  plus: "M12 5v14M5 12h14",
  pencil: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z",
} as const;

/**
 * The form itself, mounted only while the dialog is open. Keeping it separate means
 * the action state is discarded on close, so reopening never shows the previous
 * attempt's error.
 *
 * Exported because not every dialog is opened by a button standing next to it — a task
 * is edited by pressing its card — but they all report failure the same way.
 */
export function DialogForm({
  action,
  submitLabel,
  onDone,
  onCancel,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  onDone: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  // Close only once the action reports success. A rejected submission leaves the
  // dialog open, with the reason and everything already typed still in place.
  const { state, pending, handleSubmit } = useFormAction(action, { onSuccess: onDone });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {children}
      {state?.ok === false && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex gap-2 pt-2">
        <DialogSubmitButton label={submitLabel} pending={pending} />
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Trigger button plus the modal holding its form — used for both creating and editing,
 * so every entity is written through the same sheet.
 */
export function FormDialog({
  triggerLabel,
  triggerVariant = "primary",
  triggerIcon = "plus",
  title,
  submitLabel,
  action,
  children,
}: {
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
  triggerIcon?: keyof typeof ICONS | "none";
  title: string;
  submitLabel: string;
  action: FormAction;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerIcon !== "none" && (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d={ICONS[triggerIcon]} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {triggerLabel}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <DialogForm
          action={action}
          submitLabel={submitLabel}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        >
          {children}
        </DialogForm>
      </Modal>
    </>
  );
}
