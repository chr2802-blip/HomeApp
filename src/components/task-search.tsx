"use client";

import { createContext, useContext, useState } from "react";
import { EmptyState, Input } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { TASKS } from "@/lib/copy/tasks";

/** What a task is found by: its name, its notes and who it is for, already lower-cased. */
export type TaskSearchEntry = { id: string; text: string };

/** The ids the box currently lets through, or null while it is empty. */
const MatchContext = createContext<Set<string> | null>(null);

/**
 * A box to narrow `/tasks` down, above the rows it narrows.
 *
 * The rows themselves are drawn by the server page — each carries server actions and its
 * own sheet — so this does not draw them. It decides which ids match and tells them
 * through context, and a row the search leaves out is `hidden` rather than unmounted:
 * its Done button may be holding an optimistic press on its way to the server, and
 * unmounting it would drop that. Like the lists' box, nothing is kept: a page that
 * opened already narrowed would look as though tasks had gone missing.
 */
export function TaskSearch({
  entries,
  children,
}: {
  entries: TaskSearchEntry[];
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const say = sayIn(useLanguage());

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? new Set(entries.filter((entry) => entry.text.includes(needle)).map((entry) => entry.id))
    : null;

  return (
    <MatchContext.Provider value={matches}>
      <div className="relative mb-4">
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="M13 13l4 4" strokeLinecap="round" />
        </svg>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={say(TASKS.searchTasks)}
          aria-label={say(TASKS.searchTasks)}
          autoComplete="off"
          className="pl-9"
        />
      </div>
      {matches?.size === 0 && (
        <EmptyState>{say(TASKS.noMatch, { query: query.trim() })}</EmptyState>
      )}
      {children}
    </MatchContext.Provider>
  );
}

function useShown(ids: string[]): boolean {
  const matches = useContext(MatchContext);
  return matches === null || ids.some((id) => matches.has(id));
}

/** One row, hidden while the search leaves it out. */
export function TaskMatch({ id, children }: { id: string; children: React.ReactNode }) {
  return <div hidden={!useShown([id])}>{children}</div>;
}

/** A card or a section of rows, hidden once the search leaves none of them in it. */
export function TaskMatchGroup({
  ids,
  className,
  children,
}: {
  ids: string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div hidden={!useShown(ids)} className={className}>
      {children}
    </div>
  );
}

/** The finished tasks' heading, counting what the search lets through. */
export function TaskDoneSummary({ ids }: { ids: string[] }) {
  const matches = useContext(MatchContext);
  const say = sayIn(useLanguage());
  const count = matches === null ? ids.length : ids.filter((id) => matches.has(id)).length;
  return <>{say(TASKS.done, { count })}</>;
}
