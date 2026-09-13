import Link from "next/link";

/**
 * Shown for an unknown URL, and for a list or recipe that either does not exist or
 * belongs to another home — the two are deliberately indistinguishable, so a missing
 * record cannot be told apart from one you are not allowed to see.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        This page does not exist, or it belongs to a different home.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Back to the dashboard
      </Link>
    </div>
  );
}
