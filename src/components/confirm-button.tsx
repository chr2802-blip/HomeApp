"use client";

import { useRef, useState } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

/**
 * Asks before doing something irreversible, using the app's own sheet rather than the
 * browser's confirm() — which blocks the page, cannot be styled, and looks nothing like
 * the rest of the app.
 *
 * The sheet renders through a portal, so its confirm button sits outside the form in the
 * DOM. It submits the form the trigger belongs to instead of relying on being inside it.
 */
export function ConfirmButton({
  message,
  title,
  confirmLabel,
  triggerVariant = "danger",
  triggerClassName = "",
  children,
}: {
  message: string;
  title?: string;
  confirmLabel?: string;
  /** The row buttons inside a list stay quiet; page-level ones stay red. */
  triggerVariant?: "danger" | "ghost";
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const say = sayIn(useLanguage());

  function confirm() {
    const form = triggerRef.current?.closest("form");
    if (!form) return;
    setSubmitting(true);
    form.requestSubmit();
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={triggerVariant}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={title ?? say(APP.areYouSure)}>
        <ModalBody>
          <p className="text-sm text-slate-600">{message}</p>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={confirm}
              disabled={submitting}
              aria-busy={submitting}
              className="flex-1 sm:flex-none"
            >
              {submitting ? say(APP.working) : (confirmLabel ?? say(APP.delete))}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {say(APP.cancel)}
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </>
  );
}
