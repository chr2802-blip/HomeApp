import Link from "next/link";
import { redirect } from "next/navigation";
import { currentLanguage, getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { ForgetOfflineData } from "@/components/offline-support";
import { sayIn } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const language = await currentLanguage();
  const say = sayIn(language);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      {/* Reaching this page means there is no session, so nothing kept under the last
          one may stay: not the pages the worker held, and not the unsent ticks. */}
      <ForgetOfflineData />
      {/* eslint-disable-next-line no-restricted-syntax -- a proper noun, not prose */}
      <h1 className="text-2xl font-semibold tracking-tight">HomeHub</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">{say(AUTH.logInToYourHome)}</p>
      <LoginForm language={language} />
      <p className="mt-6 text-sm text-slate-500">
        {say(AUTH.gotAnInvitationCode)}{" "}
        <Link href="/accept-invite" className="font-medium text-slate-900 underline">
          {say(AUTH.createYourAccount)}
        </Link>
      </p>
    </div>
  );
}
