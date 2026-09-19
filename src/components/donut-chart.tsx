import type { HomeTheme } from "@prisma/client";

/**
 * A ring divided by size, with the total in the hole.
 *
 * The hole is the point of it rather than decoration: the one number somebody actually
 * came for — how big is this — sits in the middle at full size, and the ring around it
 * answers the second question, what it is made of. A bare pie would have room for
 * neither.
 *
 * Nothing here is interactive and nothing here is the accessible copy of the data: the
 * ring is `aria-hidden` and every chart in the app is drawn beside a legend that lists
 * the same rows as text, with the size and the share spelled out. A colour is never the
 * only thing telling two slices apart.
 */

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  /**
   * The colour, as a CSS value — a variable, so the hex is still only in globals.css.
   * Where a slice stands for a home this is `var(--accent)` and `theme` says whose.
   */
  color: string;
  /**
   * Wear another home's colours rather than the ones the page is in, the same way
   * `HomeDot` does: an attribute on the element itself, so a chart of six households
   * can show six colours while the app around it stays in the one that is open.
   */
  theme?: HomeTheme;
};

/** Hundredths of the ring left blank between slices, so two neighbours never merge. */
const GAP = 1.5;
/** What is left of a slice too thin to take the gap out of. Visible, and honest. */
const MIN = 0.6;

export function DonutChart({
  slices,
  value,
  label,
  className = "h-44 w-44",
}: {
  slices: DonutSlice[];
  /** The number in the hole, already formatted: only the caller knows what it is. */
  value: string;
  /** The word under it, saying what was measured. */
  label?: string;
  className?: string;
}) {
  const drawn = slices.filter((slice) => slice.value > 0);
  const total = drawn.reduce((running, slice) => running + slice.value, 0);

  // One slice is a whole ring, and a ring with a notch cut out of it reads as a second
  // slice that is missing rather than as the absence of a second slice.
  const gap = drawn.length > 1 ? GAP : 0;

  let offset = 0;

  return (
    <div className={`relative shrink-0 ${className}`}>
      {/* Rotated with the SVG's own transform rather than a utility class: Tailwind v4
          writes `rotate-*` as the `rotate` property, whose origin on an <svg> depends
          on how the element is laid out, while `rotate(-90 50 50)` names the centre of
          the viewBox and cannot be read any other way. */}
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <g transform="rotate(-90 50 50)">
          {/* The track, so an empty home is an empty ring rather than nothing at all. */}
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="14" />

          {total > 0 &&
            drawn.map((slice) => {
              const share = (slice.value / total) * 100;
              const length = Math.max(share - gap, MIN);
              const start = offset;
              offset += share;

              return (
                <circle
                  key={slice.key}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="14"
                  pathLength={100}
                  strokeDasharray={`${length} ${100 - length}`}
                  strokeDashoffset={-start}
                  data-theme={slice.theme}
                  /* Named so a browser test can ask what colour it actually came out.
                     A slice whose variable resolved to nothing is drawn with no stroke
                     at all, which looks from the markup exactly like one that worked. */
                  data-slice={slice.key}
                  /* A style rather than a `stroke` attribute: the colour is a custom
                     property, and only the CSS property is certain to resolve one. */
                  style={{ stroke: slice.color }}
                />
              );
            })}
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span data-donut-total className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {label && <span className="mt-0.5 text-xs text-slate-500">{label}</span>}
      </div>
    </div>
  );
}
