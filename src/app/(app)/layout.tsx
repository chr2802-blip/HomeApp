import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { BottomNav } from "@/components/bottom-nav";
import { PageTransition } from "@/components/page-transition";
import { BackButton } from "@/components/back-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-x-6 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <BackButton />
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              HomeHub
            </Link>
          </div>
          <NavLinks role={user.role} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {user.name}
              {user.homeName ? ` · ${user.homeName}` : ""}
            </span>
            <form action={logout}>
              <button className="text-slate-500 transition hover:text-slate-900 active:scale-95">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8 pb-28 md:pb-10">
        <PageTransition>{children}</PageTransition>
      </main>

      <BottomNav role={user.role} />
    </div>
  );
}
