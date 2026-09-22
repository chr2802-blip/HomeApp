"use client";

/**
 * Covers whatever it is placed inside while an action that may spend a model call is
 * pending, so a save that runs past what a button's own label reads as "still working"
 * says why — not stuck, waiting on the AI. `RecipeImportField` has its own version of
 * this for the same reason: a page fetch plus a model call can run well past what a
 * button alone can explain.
 *
 * `absolute inset-0`, not `fixed`, so it covers exactly the sheet or card the slow
 * action belongs to and nothing behind it — its parent needs `relative` (and, where the
 * parent is not already clipped, `overflow-hidden`) for that to line up with the
 * corners.
 */
export function AiOverlay({
  active,
  title,
  detail,
}: {
  active: boolean;
  title: string;
  detail: string;
}) {
  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 px-6 text-center backdrop-blur-[1px]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 animate-spin text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}
