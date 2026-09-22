"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteList, updateList } from "@/app/actions/lists";
import { Card, EmptyState, Input, Label } from "@/components/ui";
import { AmountsField } from "@/components/amounts-field";
import { Collapsible } from "@/components/collapsible";
import { FavoriteButton } from "@/components/favorite-button";
import { ItemMenu } from "@/components/item-menu";
import { PhotoField } from "@/components/photo-field";
import { PhotoThumb } from "@/components/photo";
import { ProgressBar } from "@/components/progress-bar";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

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

/** A list with every item ticked off is done — unless it is a favourite, kept in view. */
function isListDone(list: ListSummary) {
  return list.total > 0 && list.open === 0;
}

function ListCards({ lists }: { lists: ListSummary[] }) {
  const language = useLanguage();
  const say = sayIn(language);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {lists.map((list, index) => (
        <Card
          key={list.id}
          // `relative` so the progress can sit on the card's own bottom edge, and
          // `overflow-hidden` so the card's corners round it off. The three-dot
          // panel is drawn through a portal, so clipping here costs it nothing.
          className="animate-row-in relative flex items-center gap-1 overflow-hidden transition hover:border-slate-400"
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
          <Link
            href={`/lists/${list.id}`}
            prefetch
            className="pressable -m-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 active:scale-[0.98] active:bg-slate-50"
          >
            {/* Decorative: the title is right beside it, and a screen reader
                reading the same words twice helps nobody. */}
            {/* eslint-disable-next-line no-restricted-syntax -- `placeholder` picks a
                PhotoKind glyph, not copy. */}
            <PhotoThumb photoId={list.photoId} alt="" className="h-11 w-11" placeholder="list" />
            <div className="min-w-0 flex-1">
              <p className="font-medium hover:underline">{list.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {say(LISTS.openTotal, { open: list.open, total: list.total })}
              </p>
            </div>
          </Link>
          {/* Both sit to the right of the title, outside the link: a button inside
              a link is neither valid nor pressable without following it. */}
          <FavoriteButton listId={list.id} title={list.title} favorite={list.favorite} />
          <ItemMenu
            name="listId"
            id={list.id}
            label={list.title}
            editTitle={say(LISTS.editList)}
            editAction={updateList}
            deleteAction={deleteList}
            deleteMessage={say(LISTS.deleteListMessage, { title: list.title })}
            className="-mr-2"
          >
            <div className="space-y-1">
              <Label htmlFor={`title-${list.id}`}>{say(LISTS.listName)}</Label>
              <Input id={`title-${list.id}`} name="title" defaultValue={list.title} required autoFocus />
            </div>
            <AmountsField defaultChecked={list.trackAmounts} language={language} />
            <PhotoField defaultPhotoId={list.photoId} />
          </ItemMenu>

          {/* Along the card's own bottom edge rather than under the counts: the
              card is one thing, and a rounded bar floating in its padding reads as
              a second thing sitting on it. Only once there is something on the
              list — an empty track under "0 open · 0 total" says nothing the line
              above it did not. */}
          {list.total > 0 && <ProgressBar edge done={list.total - list.open} total={list.total} />}
        </Card>
      ))}
    </div>
  );
}

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
  const say = sayIn(useLanguage());

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? lists.filter((list) => list.title.toLowerCase().includes(needle))
    : lists;

  if (lists.length === 0) {
    return <EmptyState icon="📝">{say(LISTS.empty)}</EmptyState>;
  }

  // A finished list folds away like a finished task, for the same reason: it is worth
  // keeping and not worth the screen it takes above what is still outstanding. A
  // favourite stays put regardless — it is on the shelf because it is reached for
  // often, not because there is shopping left on it.
  const active = matches.filter((list) => list.favorite || !isListDone(list));
  const done = matches.filter((list) => !list.favorite && isListDone(list));

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
          placeholder={say(LISTS.searchLists)}
          aria-label={say(LISTS.searchLists)}
          autoComplete="off"
          className="pl-9"
        />
      </div>

      {matches.length === 0 ? (
        <EmptyState>{say(LISTS.noMatch, { query: query.trim() })}</EmptyState>
      ) : (
        <>
          {active.length > 0 && <ListCards lists={active} />}

          {done.length > 0 && (
            <section className={active.length > 0 ? "mt-8" : undefined}>
              <Collapsible
                summary={say(LISTS.done, { count: done.length })}
                headingClassName="mb-3 text-sm font-semibold text-slate-500 uppercase"
                triggerClassName="hover:text-slate-700"
                panelClassName="pb-1"
              >
                <ListCards lists={done} />
              </Collapsible>
            </section>
          )}
        </>
      )}
    </>
  );
}
