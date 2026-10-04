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
 * made, so nothing has to remember to clear it: a navigation that landed, or one that
 * went somewhere else, is no longer pending.
 *
 * Pass `pressed` to each link's `onNavigate`, which fires only for a navigation the
 * router is actually making — not for a modified click opening a new tab.
 */
export function usePendingHref() {
  const pathname = usePathname();
  const [press, setPress] = useState<{ href: string; from: string } | null>(null);
  const pending = press && press.from === pathname ? press.href : null;
  const pressed = (href: string) => setPress({ href, from: pathname });
  return { pending, pressed };
}
