"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isInTab, navItemsFor } from "./nav-items";
import { usePendingHref } from "./use-pending-href";
import { useLanguage } from "./language-provider";

/** Desktop navigation. On mobile the same destinations live in `BottomNav`. */
export function NavLinks({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const language = useLanguage();
  const { pending, pressed } = usePendingHref();

  return (
    <nav className="hidden items-center gap-1 text-sm md:flex">
      {navItemsFor(showAdmin, language).map((item) => {
        const active = isInTab(item, pathname);
        // One lit at a time, and it moves on the tap: see `usePendingHref`.
        const lit = pending ? pending === item.href : active;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onNavigate={() => pressed(item.href)}
            aria-current={active ? "page" : undefined}
            className="press-button rounded-lg"
          >
            <span
              className={`block rounded-lg px-3 py-1.5 transition-colors duration-(--dur-quick) ${
                lit ? "bg-[var(--accent)] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
