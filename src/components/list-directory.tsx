"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteList } from "@/app/actions/lists";
import { Card, EmptyState, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { FavoriteButton } from "@/components/favorite-button";

export type ListSummary = {
  id: string;
  title: string;
  open: number;
  total: number;
  favorite: boolean;
};

/**
 * Every list in the home, with a box to narrow them down.
 *
 * Filtering happens here rather than on the server: the lists are already on the page,
 * so there is nothing to fetch, and a household's lists number in the dozens rather
 * than the thousands. It also means each keystroke costs nothing — a round trip per
 * letter would make the box feel worse than scrolling.
 */
export function ListDirectory({ lists }: { lists: ListSummary[] }) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? lists.filter((list) => list.title.toLowerCase().includes(needle))
    : lists;

  if (lists.length === 0) {
    return <EmptyState>No lists yet — create your first one with the button above.</EmptyState>;
  }

  return (
    <>
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
          placeholder="Search lists"
          aria-label="Search lists"
          autoComplete="off"
          className="pl-9"
        />
      </div>

      {matches.length === 0 ? (
        <EmptyState>No list matches “{query.trim()}”.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((list, index) => (
            <Card
              key={list.id}
              className="animate-row-in flex items-start gap-1 transition hover:border-slate-400"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <FavoriteButton
                listId={list.id}
                title={list.title}
                favorite={list.favorite}
                className="-mt-1 -ml-1"
              />
              <Link
                href={`/lists/${list.id}`}
                prefetch
                className="pressable -m-2 min-w-0 flex-1 rounded-lg p-2 active:scale-[0.98] active:bg-slate-50"
              >
                <p className="font-medium hover:underline">{list.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {list.open} open · {list.total} total
                </p>
              </Link>
              <form action={deleteList}>
                <input type="hidden" name="listId" value={list.id} />
                <ConfirmButton message={`Delete "${list.title}" and all its items?`}>
                  Delete
                </ConfirmButton>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
