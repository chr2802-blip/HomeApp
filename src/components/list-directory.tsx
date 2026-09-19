"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteList, updateList } from "@/app/actions/lists";
import { Card, EmptyState, Input, Label } from "@/components/ui";
import { AmountsField } from "@/components/amounts-field";
import { FavoriteButton } from "@/components/favorite-button";
import { ItemMenu } from "@/components/item-menu";
import { PhotoField } from "@/components/photo-field";
import { PhotoThumb } from "@/components/photo";
import { ProgressBar } from "@/components/progress-bar";

export type ListSummary = {
  id: string;
  title: string;
  /** The list's picture, if it has one. Only the id: the thumbnail is fetched by URL. */
  photoId: string | null;
  open: number;
  total: number;
  favorite: boolean;
  /** Whether items carry a quantity — the edit sheet opens on the list's own setting. */
  trackAmounts: boolean;
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
    return (
      <EmptyState icon="📝">
        Nothing on the shelf yet — create your first list with the button above.
      </EmptyState>
    );
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
              className="animate-row-in flex items-center gap-1 transition hover:border-slate-400"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <Link
                href={`/lists/${list.id}`}
                prefetch
                className="pressable -m-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 active:scale-[0.98] active:bg-slate-50"
              >
                {/* Decorative: the title is right beside it, and a screen reader
                    reading the same words twice helps nobody. */}
                <PhotoThumb photoId={list.photoId} alt="" className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium hover:underline">{list.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {list.open} open · {list.total} total
                  </p>
                  {/* Only once there is something on it: a bar over "0 open · 0 total"
                      is an empty track saying nothing the line above it did not. */}
                  {list.total > 0 && (
                    <ProgressBar
                      done={list.total - list.open}
                      total={list.total}
                      className="mt-2"
                    />
                  )}
                </div>
              </Link>
              {/* Both sit to the right of the title, outside the link: a button inside
                  a link is neither valid nor pressable without following it. */}
              <FavoriteButton listId={list.id} title={list.title} favorite={list.favorite} />
              <ItemMenu
                name="listId"
                id={list.id}
                label={list.title}
                editTitle="Edit list"
                editAction={updateList}
                deleteAction={deleteList}
                deleteMessage={`Delete "${list.title}" and all its items?`}
                className="-mr-2"
              >
                <div className="space-y-1">
                  <Label htmlFor={`title-${list.id}`}>List name</Label>
                  <Input
                    id={`title-${list.id}`}
                    name="title"
                    defaultValue={list.title}
                    required
                    autoFocus
                  />
                </div>
                <AmountsField defaultChecked={list.trackAmounts} />
                <PhotoField defaultPhotoId={list.photoId} />
              </ItemMenu>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
