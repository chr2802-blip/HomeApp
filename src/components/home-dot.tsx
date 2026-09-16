import type { HomeTheme } from "@prisma/client";

/**
 * One home's colour, as a dot beside its name.
 *
 * It carries `data-theme` itself rather than taking a colour as a prop, so it reads the
 * variables that theme defines instead of the ones the page is wearing — which is what
 * lets a list of homes show six colours at once while the app around it stays in the
 * colours of the one that is open.
 *
 * Decorative: every one of these sits next to the name it belongs to.
 */
export function HomeDot({ theme, className = "" }: { theme: HomeTheme; className?: string }) {
  return (
    <span
      data-theme={theme}
      aria-hidden
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)] ${className}`}
    />
  );
}
