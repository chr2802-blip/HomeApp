/**
 * How much of something is ticked off, drawn as a bar.
 *
 * Decorative on purpose, in every place it is used: a list card says "1 open · 2 total"
 * directly above it and the list's own page says "1 of 2 ticked off" beside it, so a
 * screen reader announcing the same proportion a second time as a progressbar would be
 * reading the line twice. The bar is what makes that line legible at a glance, not a
 * second way of saying it.
 *
 * **The fill is the home's own `--accent`.** It was `--chart-lists`, on the reasoning
 * that a bar is read rather than pressed and would otherwise read as one more long flat
 * button — but drawn as `edge` below, flush into the card's own bottom, there is
 * nothing left for it to be mistaken for, and a household's progress through its own
 * lists is exactly the kind of thing worth dressing in that household's colour. A fixed
 * blue on every card was the one thing on those pages that belonged to no home.
 *
 * What has not changed is which colours it may not be. Green is "added" everywhere in
 * this app, red "about to be deleted", amber "overdue" — and no theme is any of them,
 * so a bar wearing the home's colour cannot accidentally say one of those. It still
 * does not turn green at the end, however much "complete" wants to: what marks the end
 * is the celebration, which happens once, rather than a colour that then stays. The
 * storage donuts keep the chart palette, which is about kinds that mean the same thing
 * in every household rather than about one household's own progress.
 *
 * `width` is an ordinary property, so `transition-[width]` really does name what moves —
 * unlike the Tailwind v4 trap that `scale-*` and `translate-*` set properties of their
 * own. A tick is optimistic, so the bar starts growing on the press rather than on the
 * answer.
 */
export function ProgressBar({
  done,
  total,
  edge = false,
  className = "",
}: {
  done: number;
  total: number;
  /**
   * Flush along the bottom of the card it belongs to, edge to edge and with no radius
   * of its own — the card is what rounds it off, so a card carrying one needs
   * `relative overflow-hidden`.
   *
   * A card is one thing, and a floating rounded bar inside its padding reads as a
   * second thing sitting on it. At the card's own edge the progress becomes part of
   * how the card is drawn, the way the hairline under the header is part of the
   * header. It is thinner than the free-standing bar for the same reason: on the edge
   * it is a rule, not a readout, and the words above it are what carry the number.
   */
  edge?: boolean;
  className?: string;
}) {
  // A list with nothing on it is not 100% done — it is a list with nothing on it, and
  // a full bar over "Nothing on it yet" would be the chart lying about the total.
  const percent = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;

  return (
    <div
      aria-hidden="true"
      // What the bar claims, in the markup, so a browser test can hold it against the
      // width the fill is actually drawn at — a fill that is there but the colour of
      // nothing, or a width the transition never arrived at, looks the same as no bar
      // in a screenshot and identical to a working one in the DOM.
      data-progress={percent}
      className={`w-full overflow-hidden bg-slate-100 ${
        edge ? "absolute inset-x-0 bottom-0 h-1" : "h-1.5 rounded-full"
      } ${className}`}
    >
      <div
        className={`h-full transition-[width] duration-500 ease-out ${
          edge ? "" : "rounded-full"
        }`}
        style={{ width: `${percent}%`, backgroundColor: "var(--accent)" }}
      />
    </div>
  );
}
