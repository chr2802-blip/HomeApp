"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { navItemsFor } from "./nav-items";
import { LinkPending } from "./link-pending";

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsFor(role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/85 backdrop-blur-lg md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="pressable group flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 active:scale-90"
              >
                <LinkPending>
                  {(pending) => {
                    // Light up as soon as the tap registers, not when the page arrives.
                    const lit = active || pending;
                    return (
                      <>
                        <span
                          className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150 ${
                            lit ? "bg-slate-900 text-white" : "text-slate-400"
                          } ${pending && !active ? "animate-pulse" : ""}`}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span
                          className={`text-[11px] leading-none font-medium transition-colors duration-150 ${
                            lit ? "text-slate-900" : "text-slate-400"
                          }`}
                        >
                          {item.label}
                        </span>
                      </>
                    );
                  }}
                </LinkPending>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
