"use client";

import { useState } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { Button } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { LISTS } from "@/lib/copy/lists";

/**
 * Puts every ticked item on a list back in one press — a packing list used on the trip
 * and wanted again for the next one, which was otherwise a tap per line.
 *
 * Asked first, in a drawer, because a list's ticks are somebody's progress through the
 * shop and one stray thumb would undo all of it. The confirm is the home's own colour
 * rather than red: nothing is deleted, every row is still there.
 */
export function UntickAllButton({ count, onConfirm }: { count: number; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const say = sayIn(useLanguage());

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="mr-2 shrink-0 px-3 py-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        {say(LISTS.untickAll)}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={say(LISTS.untickAllTitle)} size="drawer">
        <ModalBody>
          <p className="text-sm text-slate-600">{say(LISTS.untickAllMessage, { count })}</p>
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
              className="flex-1 sm:flex-none"
            >
              {say(LISTS.untickAllConfirm)}
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
