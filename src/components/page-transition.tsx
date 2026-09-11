"use client";

import { usePathname } from "next/navigation";

/** Re-keyed on every route change so the enter animation replays. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
