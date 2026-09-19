/**
 * How much of something is ticked off, drawn as a bar.
 *
 * Decorative on purpose, in every place it is used: a list card says "1 open · 2 total"
 * directly above it and the list's own page says "1 of 2 ticked off" beside it, so a
 * screen reader announcing the same proportion a second time as a progressbar would be
 * reading the line twice. The bar is what makes that line legible at a glance, not a
 * second way of saying it.
 *
 * The fill is `--chart-lists` — the same blue a list's slice wears on the storage
 * donuts, and for the same reasons that palette exists at all. Not the home's accent:
 * that dresses the controls (the button that saves, the tab that is lit) and a bar is
 * read rather than pressed, so in the household whose colour happened to match it the
 * bar would read as a long flat button. And not green at the end either, however much
 * "complete" wants to be green here: green is "added" everywhere else in the app, and a
 * bar that turns into the one colour that means something else on its last item would
 * be saying that something else. What marks the end is the celebration, which happens
 * once, rather than a colour that then stays.
 *
 * `width` is an ordinary property, so `transition-[width]` really does name what moves —
 * unlike the Tailwind v4 trap that `scale-*` and `translate-*` set properties of their
 * own. A tick is optimistic, so the bar starts growing on the press rather than on the
 * answer.
 */
export function ProgressBar({
  done,
  total,
  className = "",
}: {
  done: number;
  total: number;
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
      className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%`, backgroundColor: "var(--chart-lists)" }}
      />
    </div>
  );
}
