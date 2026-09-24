"use client";

import { useState } from "react";
import { AiOverlay, aiWaitActive, type AiWait } from "@/components/ai-overlay";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { Button, IconButton } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";
import { useLanguage } from "@/components/language-provider";
import { APP } from "@/lib/copy/app";
import { sayIn } from "@/lib/copy/say";

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
  overlay,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  onDone: () => void;
  onCancel: () => void;
  /**
   * Shown over the whole screen while the action is pending — for the one action behind
   * this dialog that spends a model call, so waiting past what the button's own label
   * says reads as the AI working rather than the app hanging. Left out everywhere else.
   */
  overlay?: AiWait;
  children: React.ReactNode;
}) {
  const language = useLanguage();
  // Close only once the action reports success. A rejected submission leaves the
  // dialog open, with the reason and everything already typed still in place.
  const { state, pending, submitted, handleSubmit } = useFormAction(action, { onSuccess: onDone });

  return (
    <form onSubmit={handleSubmit} className="relative flex min-h-0 flex-1 flex-col">
      <ModalBody className="space-y-4">{children}</ModalBody>
      {/* The reason a submission was refused belongs beside the button that will be
          pressed again, not at the bottom of a form that may be scrolled away from. */}
      <ModalFooter>
        {state?.ok === false && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {state.error}
          </p>
        )}
        <div className="flex gap-2">
          <DialogSubmitButton label={submitLabel} pending={pending} />
          <Button type="button" variant="secondary" onClick={onCancel}>
            {sayIn(language)(APP.cancel)}
          </Button>
        </div>
      </ModalFooter>
      {overlay && <AiOverlay active={aiWaitActive(overlay, pending, submitted)} wait={overlay} />}
    </form>
  );
}

function TriggerIcon({ icon }: { icon: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d={ICONS[icon]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Trigger button plus the modal holding its form — used for both creating and editing,
 * so every entity is written through the same sheet.
 *
 * `triggerShape="icon"` drops the words and keeps the icon, for the button that adds to
 * a page beside that page's own title: the heading has already said what the page holds,
 * so "New list" under "Lists" only says it again. `triggerLabel` still names the button
 * for anything that cannot see it.
 */
export function FormDialog({
  triggerLabel,
  triggerVariant = "primary",
  triggerIcon = "plus",
  triggerShape = "button",
  title,
  submitLabel,
  action,
  children,
}: {
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary" | "create";
  triggerIcon?: keyof typeof ICONS | "none";
  triggerShape?: "button" | "icon";
  title: string;
  submitLabel: string;
  action: FormAction;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {triggerShape === "icon" ? (
        <IconButton
          variant={triggerVariant}
          label={triggerLabel}
          onClick={() => setOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path d={ICONS.plus} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
      ) : (
        <Button variant={triggerVariant} onClick={() => setOpen(true)}>
          {triggerIcon !== "none" && <TriggerIcon icon={triggerIcon} />}
          {triggerLabel}
        </Button>
      )}

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
