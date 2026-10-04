"use client";

import { useLinkStatus } from "next/link";

/**
 * The answer a card or row gives to being tapped while the page it leads to is still on
 * its way: a ring in the home's own colour, drawn over the thing that was pressed.
 *
 * The press itself lasts a tenth of a second, and on a slow connection the page behind
 * it can take half a second more — which, with nothing on screen to say otherwise, reads
 * as a tap that missed and gets tapped again. Put it inside a `<Link>` that is
 * `relative` (`useLinkStatus` only reports from inside one); it takes the link's own
 * corners. It shows after a beat (`animate-link-cue`), so a prefetched page that lands
 * at once never flashes it.
 */
export function LinkCue() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      data-link-cue
      className="animate-link-cue pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] ring-2 ring-[var(--accent)] ring-inset"
    />
  );
}
