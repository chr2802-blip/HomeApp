"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
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
  action: (formData: FormData) => void | Promise<void>;
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
        <form
          action={async (formData) => {
            await action(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          {children}
          <div className="flex gap-2 pt-2">
            <SubmitButton label={submitLabel} />
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
