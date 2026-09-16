import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canAdministerCurrentHome } from "@/lib/access";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { BottomNav } from "@/components/bottom-nav";
import { PageTransition } from "@/components/page-transition";
import { BackButton } from "@/components/back-button";
import { PhotoAvatar } from "@/components/photo";
import { HomeSwitcher } from "@/components/home-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // The Administration tab administers the home on screen, so it appears for the people
  // who run that one — not for an admin of some other household they also belong to.
  const showAdmin = canAdministerCurrentHome(user);

  return (
    <div className="min-h-screen">
      {/* Tinted in the home's own colour, which is the point of the colour: the band
          across the top of every screen is the one thing always in view. */}
      <header className="sticky top-0 z-30 border-b border-[var(--accent-line)] bg-[var(--accent-soft)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-x-6 px-4 py-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <BackButton />
            {/* The household's own picture, next to its name. A home without one
                simply has no avatar rather than a placeholder standing in for it. */}
            <PhotoAvatar
              photoId={user.homePhotoId}
              alt=""
              className="mr-1 h-7 w-7 ring-2 ring-[var(--accent-line)]"
            />
            {/* The household's own name, not the product's: everyone here knows what
                the app is, and somebody between homes is told which one they are in —
                or, with none, what they are looking at. Where there are others to go
                to, the name is also the way there. */}
            {user.homes.length > 1 ? (
              <HomeSwitcher
                homes={user.homes}
                currentId={user.homeId}
                label={user.homeName ?? "HomeHub"}
              />
            ) : (
              <Link
                href="/dashboard"
                className="truncate text-lg font-semibold tracking-tight text-[var(--accent-text)]"
              >
                {user.homeName ?? "HomeHub"}
              </Link>
            )}
          </div>
          <NavLinks showAdmin={showAdmin} />
          <div className="ml-auto flex items-center gap-3 text-sm">
            {/* Just the person: the home is named at the other end of the bar. */}
            <span className="hidden text-slate-500 sm:inline">{user.name}</span>
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

      <BottomNav showAdmin={showAdmin} />
    </div>
  );
}
