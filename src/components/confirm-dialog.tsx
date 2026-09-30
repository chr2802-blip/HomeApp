"use client";

import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { Button } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

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
  title,
  message,
  confirmLabel,
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
  const say = sayIn(useLanguage());

  return (
    <Modal open={open} onClose={onClose} title={title ?? say(APP.areYouSure)} size="drawer">
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          <p className="text-sm text-slate-600">{message}</p>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-2">
            {children}
            <SubmitButton variant="danger" pendingLabel={say(APP.working)} className="flex-1 sm:flex-none">
              {confirmLabel ?? say(APP.delete)}
            </SubmitButton>
            <Button type="button" variant="secondary" onClick={onClose}>
              {say(APP.cancel)}
            </Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
}
