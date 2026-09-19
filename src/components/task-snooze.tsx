"use client";

import { useTransition } from "react";
import { ContextMenu, MenuItem } from "@/components/context-menu";
import { tick } from "@/lib/haptics";

type SnoozeAction = (formData: FormData) => void | Promise<void>;

/**
 * "Not today" as a single press, inside whatever menu the task already has.
 *
 * It builds the form data here rather than living in a `<form>`, because a menu entry
 * cannot be a submit button: the panel is a portal, it closes the moment an entry is
 * chosen, and a form inside it would be gone before the browser got round to submitting
 * it. So the action is called as the function it is, in a transition, which is also
 * what applies the revalidation it asks for.
 *
 * The same short buzz a list item and a task's Done button give, for the same reason:
 * the menu closes on the press, so without it the only feedback is the row's date
 * changing a moment later, once the server has answered.
 */
export function SnoozeMenuItem({ taskId, action }: { taskId: string; action: SnoozeAction }) {
  const [, startTransition] = useTransition();

  return (
    <MenuItem
      icon="clock"
      onSelect={() => {
        tick();
        const data = new FormData();
        data.set("taskId", taskId);
        startTransition(async () => {
          await action(data);
        });
      }}
    >
      Snooze to tomorrow
    </MenuItem>
  );
}

/**
 * The dashboard's due rows are not cards with an edit sheet behind them — they are the
 * one thing the household is being asked about this morning — so they carry a menu of
 * exactly one entry rather than the full `ItemMenu`. It is still a menu rather than a
 * button beside "Done", because two buttons of the same size next to each other is how
 * a task gets marked done by a thumb aiming at "later".
 */
export function TaskSnoozeMenu({
  taskId,
  title,
  action,
  className = "",
}: {
  taskId: string;
  /** The task's own name, so a dashboard full of menus says which is which. */
  title: string;
  action: SnoozeAction;
  className?: string;
}) {
  return (
    <ContextMenu label={title} className={className}>
      <SnoozeMenuItem taskId={taskId} action={action} />
    </ContextMenu>
  );
}
