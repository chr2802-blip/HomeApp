import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Enter the email you were invited with and the code your home admin gave you.
      </p>
      <AcceptInviteForm />
      <p className="mt-6 text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
