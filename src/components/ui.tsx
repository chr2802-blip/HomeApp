import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "pressable inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100";

const variants = {
  /* The home's own colour: the button that saves is the one control on every screen,
     so it is where a household's colour is worth spending. */
  primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
  /* Outlined, and red however the home is dressed: what it does is the same everywhere,
     and a filled primary beside it is what keeps the two apart at a glance. */
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
  /** Adding something. The one green in the app, so it means only that. */
  create: "bg-emerald-600 text-white hover:bg-emerald-700",
} as const;

type Variant = keyof typeof variants;

/**
 * The button look as a string, for the few controls that cannot be a `Button` because
 * something else owns the element — a context menu builds its own trigger, so that it
 * can hang the menu's state on it. Everything else uses the components below.
 */
export function buttonClass(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/**
 * `padded` rather than a `p-0` in className: both are padding utilities, and which one
 * wins is decided by their order in the stylesheet, not in the class attribute — so
 * overriding from outside silently left the padding in place.
 */
export function Card({
  className = "",
  padded = true,
  ...props
}: ComponentProps<"div"> & { padded?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${
        padded ? "p-5" : ""
      } ${className}`}
      {...props}
    />
  );
}

/**
 * A round button carrying one icon and no words.
 *
 * It builds its own classes rather than reusing `Button`'s: the shared base sets
 * padding, and which of two padding utilities wins is decided by their order in the
 * stylesheet rather than in the class attribute — the same trap `Card`'s `padded`
 * exists to avoid. A name is required, because there is no label to read.
 */
export function IconButton({
  variant = "primary",
  label,
  className = "",
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { variant?: Variant; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full active:scale-[0.92] disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)] ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)] ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)] ${className}`}
      {...props}
    />
  );
}

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return (
    <label className={`block text-sm font-medium text-slate-700 ${className}`} {...props} />
  );
}

/**
 * The title, whatever the page does to itself on the right of it, and the description
 * below. The description clears the row rather than tucking under the heading: the
 * control opposite it is the tallest thing in the row, and a line of grey text running
 * up against it reads as part of the button.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {action}
      </div>
      {description && <p className="mt-3 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "red" | "amber" | "green";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
