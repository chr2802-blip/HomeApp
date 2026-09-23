import Link from "next/link";
import { currentLanguage, getCurrentUser } from "@/lib/auth";
import { AcceptInviteForm } from "./accept-invite-form";
import { sayIn } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";

/**
 * Somebody signed in is left here rather than sent to their dashboard: they may be in
 * one home already and accepting an invitation into the next, which is the same code
 * redeemed by the same page.
 */
export default async function AcceptInvitePage() {
  const user = await getCurrentUser();
  const account = user ? { email: user.email, name: user.name } : null;
  const language = await currentLanguage();
  const say = sayIn(language);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {account ? say(AUTH.joinAHome) : say(AUTH.createYourAccount)}
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {account ? say(AUTH.joinHint) : say(AUTH.createAccountHint)}
      </p>
      <AcceptInviteForm account={account} language={language} />
      {account ? (
        <p className="mt-6 text-sm text-slate-500">
          <Link href="/homes" className="font-medium text-slate-900 underline">
            {say(AUTH.backToYourHomes)}
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          {say(AUTH.alreadyHaveAccount)}{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            {say(AUTH.logIn)}
          </Link>
        </p>
      )}
    </div>
  );
}
