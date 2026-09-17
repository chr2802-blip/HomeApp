"use client";

import { useId, useState } from "react";

/**
 * A heading that folds what is under it away.
 *
 * It exists for the parts of a page that are finished business: a list's ticked-off
 * items, the tasks a household has already done. Both are worth keeping — the one is
 * next week's vocabulary, the other is the record that it was done — and neither is
 * worth the screen it takes up above what is still outstanding.
 *
 * Folded away to begin with, and it says how much is in there, because a heading that
 * hides an unknown quantity is one nobody opens. The chevron turns rather than the
 * panel sliding: the panel's height is whatever the contents are, and an animation
 * between two unknown heights is one that stutters on the only phone that matters.
 */
export function Collapsible({
  summary,
  defaultOpen = false,
  headingClassName,
  triggerClassName = "",
  panelClassName = "",
  children,
}: {
  /** What the trigger says beside the chevron — usually a name and a count. */
  summary: React.ReactNode;
  defaultOpen?: boolean;
  /**
   * Given where what is folded away is a section of the page rather than part of a
   * card: the trigger is then wrapped in a heading carrying these classes, so the
   * page's outline is the same whether the section happens to be open or shut.
   */
  headingClassName?: string;
  triggerClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((shown) => !shown)}
      aria-expanded={open}
      aria-controls={panelId}
      className={`pressable flex items-center gap-2 text-left ${triggerClassName}`}
    >
      <svg
        viewBox="0 0 20 20"
        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
          open ? "rotate-90" : ""
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {summary}
    </button>
  );

  return (
    <>
      {headingClassName === undefined ? trigger : <h2 className={headingClassName}>{trigger}</h2>}
      {open && (
        <div id={panelId} className={panelClassName}>
          {children}
        </div>
      )}
    </>
  );
}
