"use client";

import { useLinkStatus } from "next/link";

/**
 * `useLinkStatus` only reports from inside a <Link>, so this renders as a child and
 * passes the flag back up. It flips true the moment a navigation starts, which is what
 * makes a tap feel acknowledged before the server has replied.
 */
export function LinkPending({ children }: { children: (pending: boolean) => React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <>{children(pending)}</>;
}
