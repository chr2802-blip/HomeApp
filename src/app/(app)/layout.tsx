import { requireUser } from "@/lib/auth";
import { canAdministerCurrentHome } from "@/lib/access";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { BottomNav } from "@/components/bottom-nav";
import { PageTransition } from "@/components/page-transition";
import { BackButton } from "@/components/back-button";
import { HomeMenu } from "@/components/home-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Admin is the installation, not a household: the list of every home and how the
  // deployment itself is doing. Running a home is administered from that home's own
  // Settings, behind its name in the header, so the tab belongs to the one person the
  // whole installation is for.
  const showAdmin = user.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-x-6 px-4 py-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <BackButton />
            {/* The household's own picture and name, not the product's: everyone here
                knows what the app is, and somebody between homes is told which one they
                are in — or, with none, what they are looking at. Pressing the pair is
                also the way to this home's settings, to your own profile, and to the
                other homes you are in. */}
            <HomeMenu
              homes={user.homes}
              currentId={user.homeId}
              label={user.homeName ?? "HomeHub"}
              photoId={user.homePhotoId}
              canAdminister={canAdministerCurrentHome(user)}
            />
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
