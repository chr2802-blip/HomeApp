"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { Button, Input, buttonClass } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn, type Say } from "@/lib/copy/say";
import { NEMLIG, NEMLIG_FAILURE } from "@/lib/copy/nemlig";
import { NEMLIG_BASKET_URL, type NemligProduct } from "@/lib/nemlig";
import { formatKroner, type Proposal } from "@/lib/nemlig-basket";
import { reviewForNemlig, searchNemlig, sendToNemlig, type NemligSent } from "@/app/actions/nemlig";

/** One row of the review, as the household is leaving it. */
type Row = {
  proposal: Proposal;
  chosen: NemligProduct | null;
  results: NemligProduct[];
  quantity: number;
  skip: boolean;
  picking: boolean;
};

type Stage =
  | { at: "loading" }
  | { at: "error"; message: string }
  | { at: "review" }
  | { at: "sending" }
  | { at: "summary"; sent: Extract<NemligSent, { ok: true }>; skipped: string[] };

/**
 * "Send to Nemlig" on a list's page: a review of what would go in the household's
 * nemlig.com basket, then the basket filled, then what happened.
 *
 * A full-screen sheet rather than a drawer, because there are choices on every row. The
 * review is asked for when the sheet opens, not when the page draws — searching Nemlig
 * is seconds, and most visits to a list are to tick things off.
 *
 * Nothing is added until "Put in the basket" is pressed, and the button says how many.
 */
export function NemligSend({ listId }: { listId: string }) {
  const language = useLanguage();
  const say = sayIn(language);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ at: "loading" });
  const [rows, setRows] = useState<Row[]>([]);
  const [ready, setReady] = useState(false);
  const [, startTransition] = useTransition();
  useEffect(() => setReady(true), []);

  function review() {
    setStage({ at: "loading" });
    startTransition(async () => {
      const answer = await reviewForNemlig(listId);
      if (!answer.ok) return setStage({ at: "error", message: answer.error });
      setRows(
        answer.proposals.map((proposal) => ({
          proposal,
          chosen: proposal.chosen,
          results: proposal.results,
          quantity: proposal.quantity,
          skip: proposal.chosen === null,
          picking: false,
        })),
      );
      setStage({ at: "review" });
    });
  }

  function start() {
    setOpen(true);
    review();
  }

  const update = (index: number, change: Partial<Row>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...change } : row)));

  const going = rows.filter((row) => !row.skip && row.chosen);
  const estimate = going.reduce((sum, row) => sum + (row.chosen?.price ?? 0) * row.quantity, 0);

  function send() {
    setStage({ at: "sending" });
    const skipped = rows.filter((row) => row.skip || !row.chosen).map((row) => row.proposal.text);
    startTransition(async () => {
      const sent = await sendToNemlig(
        listId,
        going.map((row) => ({
          itemId: row.proposal.itemId,
          quantity: row.quantity,
          product: { id: row.chosen!.id, name: row.chosen!.name, imageUrl: row.chosen!.imageUrl },
        })),
      );
      if (!sent.ok) return setStage({ at: "error", message: sent.error });
      setStage({ at: "summary", sent, skipped });
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={say(NEMLIG.send)}
        title={say(NEMLIG.send)}
        aria-haspopup="dialog"
        data-ready={ready ? "true" : undefined}
        onClick={start}
        className="press-icon inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <BasketIcon />
        <span aria-hidden="true">{say(NEMLIG.short)}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={say(NEMLIG.send)}>
        {stage.at === "loading" || stage.at === "sending" ? (
          <ModalBody className="flex flex-col items-center justify-center gap-3 text-center text-slate-600">
            <BasketIcon className="h-10 w-10 text-[var(--accent-text)]" />
            <p role="status">{say(stage.at === "loading" ? NEMLIG.searching : NEMLIG.adding)}</p>
          </ModalBody>
        ) : stage.at === "error" ? (
          <>
            <ModalBody>
              <p role="alert" className="text-sm text-red-600">
                {stage.message}
              </p>
            </ModalBody>
            <ModalFooter>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  {say(NEMLIG.done)}
                </Button>
                <Button onClick={review}>{say(NEMLIG.tryAgain)}</Button>
              </div>
            </ModalFooter>
          </>
        ) : stage.at === "summary" ? (
          <Summary say={say} sent={stage.sent} skipped={stage.skipped} onDone={() => setOpen(false)} />
        ) : rows.length === 0 ? (
          <ModalBody>
            <p className="text-sm text-slate-600">{say(NEMLIG.nothingOpen)}</p>
          </ModalBody>
        ) : (
          <>
            <ModalBody className="space-y-3">
              <p className="text-sm text-slate-600">{say(NEMLIG.reviewIntro)}</p>
              <ul className="space-y-3">
                {rows.map((row, index) => (
                  <ReviewRow
                    key={row.proposal.itemId}
                    row={row}
                    say={say}
                    language={language}
                    onChange={(change) => update(index, change)}
                  />
                ))}
              </ul>
            </ModalBody>
            <ModalFooter>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600 tabular-nums">
                  {going.length > 0 ? say(NEMLIG.estimate, { amount: formatKroner(estimate, language) }) : ""}
                </p>
                <Button onClick={send} disabled={going.length === 0}>
                  {going.length === 0
                    ? say(NEMLIG.nothingChosen)
                    : say(NEMLIG.putInBasket, { count: going.length })}
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </Modal>
    </>
  );
}

function ReviewRow({
  row,
  say,
  language,
  onChange,
}: {
  row: Row;
  say: Say;
  language: "EN" | "DA";
  onChange: (change: Partial<Row>) => void;
}) {
  const { proposal, chosen } = row;
  const [query, setQuery] = useState(proposal.term);
  const [searching, startSearch] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);

  function search(event: React.FormEvent) {
    event.preventDefault();
    setSearchError(null);
    startSearch(async () => {
      const answer = await searchNemlig(query);
      if (!answer.ok) return setSearchError(answer.error);
      onChange({ results: answer.products });
    });
  }

  return (
    <li
      data-nemlig-row={proposal.text}
      className={`rounded-xl border border-slate-200 bg-white p-3 ${row.skip && chosen ? "opacity-60" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 font-medium break-words">{proposal.text}</p>
        {!row.skip && chosen && (
          <Stepper
            value={row.quantity}
            name={proposal.text}
            say={say}
            onChange={(quantity) => onChange({ quantity })}
          />
        )}
      </div>

      {!chosen ? (
        <p className="mt-1 text-sm text-amber-700">{say(NEMLIG_FAILURE[proposal.problem ?? "notFound"])}</p>
      ) : row.skip ? (
        <p className="mt-1 text-sm text-slate-500">{say(NEMLIG.skipped)}</p>
      ) : (
        <ProductLine product={chosen} say={say} language={language} remembered={proposal.remembered && chosen.id === proposal.chosen?.id} />
      )}

      <div className="mt-2 flex gap-2">
        <Button variant="secondary" className="px-3 py-1.5" onClick={() => onChange({ picking: !row.picking })} aria-expanded={row.picking}>
          {say(NEMLIG.change)}
        </Button>
        {chosen && (
          <Button variant="ghost" className="px-3 py-1.5" onClick={() => onChange({ skip: !row.skip })}>
            {say(row.skip ? NEMLIG.include : NEMLIG.skip)}
          </Button>
        )}
      </div>

      {row.picking && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <form onSubmit={search} className="flex gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={say(NEMLIG.searchAgain)}
              placeholder={say(NEMLIG.searchAgain)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" disabled={searching} aria-busy={searching}>
              {say(NEMLIG.searchButton)}
            </Button>
          </form>
          {searchError && (
            <p role="alert" className="text-sm text-red-600">
              {searchError}
            </p>
          )}
          {row.results.length === 0 ? (
            <p className="text-sm text-slate-500">{say(NEMLIG.noResults)}</p>
          ) : (
            <ul aria-label={say(NEMLIG.choose)} className="space-y-1">
              {row.results.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    disabled={!product.available}
                    aria-pressed={chosen?.id === product.id}
                    onClick={() => onChange({ chosen: product, skip: false, picking: false })}
                    className={`press-card w-full rounded-lg px-2 py-1 text-left disabled:opacity-50 ${
                      chosen?.id === product.id ? "bg-[color-mix(in_srgb,var(--accent)_10%,white)] ring-1 ring-[var(--accent)]" : "hover:bg-slate-50"
                    }`}
                  >
                    <ProductLine product={product} say={say} language={language} remembered={false} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function ProductLine({
  product,
  say,
  language,
  remembered,
}: {
  product: NemligProduct;
  say: Say;
  language: "EN" | "DA";
  remembered: boolean;
}) {
  return (
    <div className="mt-1 flex items-center gap-3">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Nemlig's own picture, at its own address.
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain"
        />
      ) : (
        <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_14%,white)] text-[var(--accent-text)]">
          <BasketIcon />
        </span>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="break-words text-slate-900">{product.name}</p>
        <p className="text-xs text-slate-500">
          {[product.size, product.price !== null ? say(NEMLIG.price, { amount: formatKroner(product.price, language) }) : say(NEMLIG.noPrice)]
            .filter(Boolean)
            .join(" · ")}
          {!product.available && <span className="text-amber-700"> · {say(NEMLIG.soldOut)}</span>}
        </p>
        {remembered && <p className="text-xs font-medium text-[var(--accent-text)]">{say(NEMLIG.rememberedMark)}</p>}
      </div>
    </div>
  );
}

function Stepper({
  value,
  name,
  say,
  onChange,
}: {
  value: number;
  name: string;
  say: Say;
  onChange: (value: number) => void;
}) {
  const step = "press-icon inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 disabled:opacity-40";
  return (
    <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
      <button type="button" className={step} aria-label={say(NEMLIG.less, { name })} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="min-w-5 text-center text-sm">{value}</span>
      <button type="button" className={step} aria-label={say(NEMLIG.more, { name })} disabled={value >= 99} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function Summary({
  say,
  sent,
  skipped,
  onDone,
}: {
  say: Say;
  sent: Extract<NemligSent, { ok: true }>;
  skipped: string[];
  onDone: () => void;
}) {
  return (
    <>
      <ModalBody className="space-y-5">
        <section>
          <h3 className="mb-1 text-sm font-semibold text-emerald-700">{say(NEMLIG.addedHeading, { count: sent.added.length })}</h3>
          <ul className="space-y-0.5 text-sm">
            {sent.added.map((row) => (
              <li key={row.itemId}>
                {row.quantity} × {row.name}
              </li>
            ))}
          </ul>
        </section>
        {skipped.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-500">{say(NEMLIG.skippedHeading, { count: skipped.length })}</h3>
            <p className="text-sm text-slate-600">{skipped.join(", ")}</p>
          </section>
        )}
        {sent.failed.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-red-600">{say(NEMLIG.failedHeading, { count: sent.failed.length })}</h3>
            <ul className="space-y-1 text-sm">
              {sent.failed.map((row) => (
                <li key={row.itemId}>
                  <span className="font-medium">{row.text}</span>
                  <span className="text-slate-600"> — {row.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-slate-500">{say(NEMLIG.basketNote)}</p>
      </ModalBody>
      <ModalFooter>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onDone}>
            {say(NEMLIG.done)}
          </Button>
          <a href={NEMLIG_BASKET_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
            {say(NEMLIG.openBasket)}
          </a>
        </div>
      </ModalFooter>
    </>
  );
}

function BasketIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 10h14l-1.5 9a1.5 1.5 0 0 1-1.5 1.25H8A1.5 1.5 0 0 1 6.5 19L5 10Z" />
      <path d="M9 10 11 4M15 10l-2-6M3 10h18M10 14v3M14 14v3" />
    </svg>
  );
}
