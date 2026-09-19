import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AcceptInviteForm } from "./accept-invite-form";

/**
 * Somebody signed in is left here rather than sent to their dashboard: they may be in
 * one home already and accepting an invitation into the next, which is the same code
 * redeemed by the same page.
 *
 * The emailed link arrives here with both answers in the query string, which is the
 * whole point of it being a link: the invitee presses one thing and is left with only
 * what the app cannot know — their name and their password. Nothing is accepted by
 * arriving; the form is still submitted, and still checked, exactly as a typed-in code
 * would be.
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; code?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);

  // The address the link names wins over the one the reader happens to be signed in
  // as: the invitation is for a named address, and somebody signed in as themselves
  // may well be opening a link sent to a housemate on a shared laptop.
  const invitedEmail = params.email?.trim().toLowerCase() || null;

  // Whose invitation this is, as far as the page can tell: the signed-in person, but
  // only when the link does not name somebody else. Their name is then already known
  // and their password is the one they have, which is what the wording below turns on.
  const account =
    user && (!invitedEmail || invitedEmail === user.email)
      ? { email: user.email, name: user.name }
      : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {account ? "Join a home" : "Create your account"}
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {account
          ? "Enter the email you were invited with and the code you were given. The home joins the ones you are already in."
          : "Enter the email you were invited with and the code your home admin gave you."}
      </p>
      <AcceptInviteForm
        account={account}
        email={invitedEmail ?? account?.email ?? null}
        code={params.code ?? null}
      />
      {account ? (
        <p className="mt-6 text-sm text-slate-500">
          <Link href="/homes" className="font-medium text-slate-900 underline">
            Back to your homes
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}
