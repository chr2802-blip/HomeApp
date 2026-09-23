import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { APP } from "@/lib/copy/app";
import { sayIn } from "@/lib/copy/say";
import { DEFAULT_LANGUAGE } from "@/lib/language";

/**
 * Shown for an unknown URL, and for a list or recipe that either does not exist or
 * belongs to another home — the two are deliberately indistinguishable, so a missing
 * record cannot be told apart from one you are not allowed to see.
 */
export default async function NotFound() {
  // Read the way the root layout reads it: a stale link is followed signed in as often
  // as not, and somebody signed out is told in the app's default voice.
  const say = sayIn((await getCurrentUser())?.homeLanguage ?? DEFAULT_LANGUAGE);
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{say(APP.error.notFound)}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {say(APP.error.notFoundBody)}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        {say(APP.error.backToDashboard)}
      </Link>
    </div>
  );
}
