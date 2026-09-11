"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPending } from "./link-pending";

/** Top-level destinations — these are the tabs, so there is nothing to go back to. */
const ROOTS = new Set(["/dashboard", "/lists", "/tasks", "/recipes", "/admin"]);

/**
 * Walks one segment up the URL rather than using history, so the target is the same
 * whether you arrived by tapping through or opened the page from a link or a refresh.
 */
function parentOf(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  segments.pop();
  return segments.length ? `/${segments.join("/")}` : "/dashboard";
}

export function BackButton() {
  const pathname = usePathname();
  if (ROOTS.has(pathname)) return null;

  return (
    <Link
      href={parentOf(pathname)}
      prefetch
      aria-label="Back"
      className="pressable -ml-1.5 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:scale-90 active:bg-slate-200"
    >
      <LinkPending>
        {(pending) => (
          <svg
            viewBox="0 0 24 24"
            className={`h-5 w-5 transition-transform duration-150 ${
              pending ? "-translate-x-0.5 opacity-60" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </LinkPending>
    </Link>
  );
}
