"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Which of a row of links the reader has just pressed, while its page is on the way.
 *
 * A row of tabs lights exactly one: the one that will be showing. `useLinkStatus`
 * answers per link, so the tab being left had no way to know another had been pressed
 * and stayed lit beside it — two lit tabs for as long as the server took. This keeps the
 * press for the whole row, and drops it the moment the path moves on from where it was
 * made: a navigation that landed, or one that went somewhere else, is no longer pending.
 *
 * Dropped, not merely ignored. The rows live in the app layout and outlast every page,
 * so a press kept beside the path it was made from came back to life whenever the reader
 * returned there — press Supplies on /lists, wander off, tap Lists in the tab bar, and the
 * pill sat on Supplies over the lists page for good.
 *
 * Pass `pressed` to each link's `onNavigate`, which fires only for a navigation the
 * router is actually making — not for a modified click opening a new tab.
 */
export function usePendingHref() {
  const pathname = usePathname();
  const [press, setPress] = useState<{ href: string; from: string } | null>(null);
  if (press && press.from !== pathname) setPress(null);
  const pending = press && press.from === pathname ? press.href : null;
  const pressed = (href: string) => setPress({ href, from: pathname });
  return { pending, pressed };
}
