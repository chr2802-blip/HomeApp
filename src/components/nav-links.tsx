"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemsFor } from "./nav-items";
import { LinkPending } from "./link-pending";

/** Desktop navigation. On mobile the same destinations live in `BottomNav`. */
export function NavLinks({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 text-sm md:flex">
      {navItemsFor(showAdmin).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className="pressable rounded-lg active:scale-95"
          >
            <LinkPending>
              {(pending) => (
                <span
                  className={`block rounded-lg px-3 py-1.5 transition-colors duration-150 ${
                    active || pending
                      ? "bg-[var(--accent)] text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  } ${pending && !active ? "animate-pulse" : ""}`}
                >
                  {item.label}
                </span>
              )}
            </LinkPending>
          </Link>
        );
      })}
    </nav>
  );
}
