import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">HomeHub</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Log in to your home.</p>
      <LoginForm />
      <p className="mt-6 text-sm text-slate-500">
        Got an invitation code?{" "}
        <Link href="/accept-invite" className="font-medium text-slate-900 underline">
          Create your account
        </Link>
      </p>
    </div>
  );
}
