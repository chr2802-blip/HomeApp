import { requireUser } from "@/lib/auth";
import { canAdministerCurrentHome } from "@/lib/access";
import { logout } from "@/app/actions/auth";
import { NavLinks } from "@/components/nav-links";
import { BottomNav } from "@/components/bottom-nav";
import { PageTransition } from "@/components/page-transition";
import { BackButton } from "@/components/back-button";
import { HomeMenu } from "@/components/home-menu";
import { OfflineSupport } from "@/components/offline-support";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Admin is the installation, not a household: the list of every home and how the
  // deployment itself is doing. Running a home is administered from that home's own
  // Settings, behind its name in the header, so the tab belongs to the one person the
  // whole installation is for.
  const showAdmin = user.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen">
      {/* Asked for on every page rather than when notifications are turned on: what
          keeps a list readable in a shop has to be installed before the signal goes. */}
      <OfflineSupport />

      {/* Tinted in the home's own colour, which is the point of the colour: the band
          across the top of every screen is the one thing always in view. */}
      {/* The band starts at the very top of the screen, not below the clock: the page
          is laid out under the phone's bars (`viewportFit` in the root layout), so the
          header pads itself past the top inset and paints the strip above its own row.
          Without that padding the name and the back arrow sit under the clock. */}
      <header className="sticky top-0 z-30 border-b border-[var(--accent-line)] bg-[var(--band)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center gap-x-6 py-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
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

      {/* The tab bar is as tall as it was plus whatever the phone's gesture bar takes,
          so what clears it has to be too — a fixed 7rem leaves the last card under the
          tabs on a phone that reserves anything at the bottom. */}
      <main className="mx-auto max-w-5xl pt-8 pb-[calc(7rem+env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:pb-10">
        <PageTransition>{children}</PageTransition>
      </main>

      <BottomNav showAdmin={showAdmin} />
    </div>
  );
}
