import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AcceptInviteForm } from "./accept-invite-form";

/**
 * Somebody signed in is left here rather than sent to their dashboard: they may be in
 * one home already and accepting an invitation into the next, which is the same code
 * redeemed by the same page.
 */
export default async function AcceptInvitePage() {
  const user = await getCurrentUser();
  const account = user ? { email: user.email, name: user.name } : null;

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
      <AcceptInviteForm account={account} />
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
