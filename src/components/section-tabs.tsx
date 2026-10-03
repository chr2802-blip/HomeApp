"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";
import { useLanguage } from "./language-provider";

/**
 * The pages inside one tab. A tab is an area of the household's life, and these are
 * its pages, a sideways step apart. Drawn only on a segment's own top-level page — a
 * recipe or an open list is somewhere you went *into*, and the back arrow takes you out.
 */
const SECTIONS: { href: string; key: keyof typeof APP.sections }[][] = [
  [
    { href: "/meals", key: "meals" },
    { href: "/recipes", key: "recipes" },
  ],
  [
    { href: "/lists", key: "lists" },
    { href: "/pantry", key: "supplies" },
  ],
];

export function SectionTabs() {
  const pathname = usePathname();
  const say = sayIn(useLanguage());
  const section = SECTIONS.find((s) => s.some((seg) => seg.href === pathname));
  if (!section) return null;

  return (
    <nav className="-mt-4 mb-5 flex rounded-full bg-slate-200/70 p-1">
      {section.map((seg) => {
        const active = seg.href === pathname;
        return (
          <Link
            key={seg.href}
            href={seg.href}
            prefetch
            replace
            aria-current={active ? "page" : undefined}
            className={`pressable flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors duration-150 ${
              active ? "bg-[var(--accent)] text-white shadow-sm" : "text-slate-500"
            }`}
          >
            {say(APP.sections[seg.key])}
          </Link>
        );
      })}
    </nav>
  );
}
