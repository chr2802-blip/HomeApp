"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal, ModalBody } from "@/components/modal";
import { Input, Label } from "@/components/ui";
import { PhotoThumb } from "@/components/photo";
import { useLanguage } from "@/components/language-provider";
import { pantryCookCandidates } from "@/app/actions/pantry";
import { namesInWords, pantryKey } from "@/lib/pantry";
import { rankByPantry, type CookCandidate } from "@/lib/pantry-cook";
import { sayIn } from "@/lib/copy/say";
import { PANTRY_COOK } from "@/lib/copy/pantry";
import { LinkCue } from "@/components/link-cue";

type Loaded = { candidates: CookCandidate[]; stocked: string[] };

/**
 * "What can we cook?": the five recipes that use most of what the kitchen has, and a box
 * for what it has that the pantry does not keep — the chicken bought yesterday, the
 * leftover cream.
 *
 * The recipes are asked for when the sheet opens, once, and ranked here: typing an extra
 * re-ranks at once. What is typed lives in this sheet and nowhere else — it is today's
 * fridge, not the cupboard the pantry describes — so it is gone on the next visit.
 *
 * A whole-screen sheet rather than a drawer, because it has a field to fill in.
 */
export function PantryCook() {
  const language = useLanguage();
  const say = sayIn(language);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  function show() {
    setOpen(true);
    setFailed(false);
    // Asked afresh on every open: the pantry may have changed under the sheet since.
    pantryCookCandidates().then(setLoaded, () => setFailed(true));
  }

  function addExtra() {
    const name = draft.trim();
    setDraft("");
    if (!pantryKey(name)) return;
    setExtras((current) =>
      current.some((extra) => pantryKey(extra) === pantryKey(name)) ? current : [...current, name],
    );
  }

  const matches = loaded
    ? rankByPantry({
        candidates: loaded.candidates,
        stocked: new Set([...loaded.stocked, ...extras.map(pantryKey)]),
      })
    : [];

  return (
    <>
      {/* An icon, like the cart that takes its place under "Only run out": a label
          beside the count wrapped the count onto two lines on a phone. */}
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-label={say(PANTRY_COOK.button)}
        title={say(PANTRY_COOK.button)}
        className="press-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      >
        <PotIcon />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={say(PANTRY_COOK.button)}>
        <ModalBody>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              addExtra();
            }}
            className="space-y-1"
          >
            <Label htmlFor="pantry-cook-extra">{say(PANTRY_COOK.extraLabel)}</Label>
            <div className="flex gap-2">
              <Input
                id="pantry-cook-extra"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={say(PANTRY_COOK.extraPlaceholder)}
                autoComplete="off"
                enterKeyHint="done"
                className="min-w-0 flex-1"
              />
              <button
                type="submit"
                className="press-button h-10 shrink-0 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-white"
              >
                {say(PANTRY_COOK.extraAdd)}
              </button>
            </div>
            <p className="text-xs text-slate-500">{say(PANTRY_COOK.extraHint)}</p>
          </form>

          {extras.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {extras.map((extra) => (
                <li key={extra}>
                  <button
                    type="button"
                    onClick={() => setExtras((current) => current.filter((other) => other !== extra))}
                    aria-label={say(PANTRY_COOK.removeExtra, { name: extra })}
                    className="press-button inline-flex items-center gap-1 rounded-full bg-[var(--accent)] py-1 pr-2 pl-3 text-sm text-white"
                  >
                    {extra}
                    <span aria-hidden="true" className="text-base leading-none">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5" aria-live="polite">
            {failed ? (
              <p className="text-sm text-slate-500">{say(PANTRY_COOK.failed)}</p>
            ) : !loaded ? (
              <p className="text-sm text-slate-500">{say(PANTRY_COOK.loading)}</p>
            ) : matches.length === 0 ? (
              <p className="text-sm text-slate-500">{say(PANTRY_COOK.none)}</p>
            ) : (
              <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200" data-pantry-cook>
                {matches.map((match) => (
                  <li key={match.recipeId}>
                    <Link
                      href={`/recipes/${match.recipeId}`}
                      className="press-card relative flex items-center gap-3 px-3 py-3 hover:bg-slate-50"
                    >
                      <PhotoThumb photoId={match.photoId} alt="" placeholder="recipe" className="h-12 w-12" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800">{match.title}</span>
                        <span className="block text-sm text-slate-600">
                          {say(PANTRY_COOK.have, { have: match.have, count: match.total })}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {match.missing.length === 0
                            ? say(PANTRY_COOK.haveAll)
                            : say(PANTRY_COOK.missing, { names: namesInWords(match.missing, language) })}
                        </span>
                      </span>
                      <MatchRing have={match.have} total={match.total} />
                      <LinkCue />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </ModalBody>
      </Modal>
    </>
  );
}

/** How much of the recipe is in, as a ring in the home's colour. Decorative: the same
 *  number is in words beside it. */
function MatchRing({ have, total }: { have: number; total: number }) {
  const circumference = 2 * Math.PI * 14;
  return (
    <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r="14" fill="none" stroke="var(--band)" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${(have / total) * circumference} ${circumference}`}
      />
    </svg>
  );
}

function PotIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6Z" strokeLinejoin="round" />
      <path d="M2 10h2M20 10h2M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2" strokeLinecap="round" />
    </svg>
  );
}
