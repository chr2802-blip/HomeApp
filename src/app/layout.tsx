import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { getCurrentUser } from "@/lib/auth";
import { APP_BAND, DEFAULT_THEME } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeHub",
  description: "Lists, recurring tasks and recipes for your home.",
  manifest: "/manifest.webmanifest",
  /*
   * Installed from Safari, the app runs with no chrome of its own and the strip above it
   * holds the clock and the battery. `default` is what puts the phone's own dark glyphs
   * there, which is the only readable choice against a white band — the translucent
   * style would hand the strip to the app and turn those glyphs white on white. What it
   * is painted with is the document's background, which carries the band in globals.css.
   */
  appleWebApp: { capable: true, title: "HomeHub", statusBarStyle: "default" },
};

/**
 * The browser's own chrome, above the header.
 *
 * The band, so a tab's toolbar continues the app rather than sitting on top of it. It no
 * longer depends on who is asking — the band is the app's own colour now, for the reason
 * given in `lib/theme.ts` — so this is declared rather than worked out per request, and
 * the session is read once by the layout below instead of twice.
 *
 * An installed app has no chrome for this to colour: on iOS the strip above the header
 * comes from the document's background, and on Android from the manifest. All three are
 * the same colour, which is the point.
 */
export const viewport: Viewport = {
  themeColor: APP_BAND,
  width: "device-width",
  initialScale: 1,
  /*
   * The app is laid out to the edges of the screen, under the phone's own bars.
   *
   * Without this the viewport stops above the gesture bar, and the strip the phone
   * draws there is the phone's — painted, on Android, from the manifest at install and
   * from nothing the page can say afterwards. With it the strip is inside the viewport
   * and the tab bar's own band reaches it, so the bottom of the screen is the app's
   * pixels rather than a colour agreed with the phone beforehand.
   *
   * What it costs is that the layout is now responsible for the insets it just took on:
   * `env(safe-area-inset-*)` is no longer zero, the header pads by the top one and the
   * tab bar by the bottom one, and a form's buttons already did (`ModalFooter`). Get
   * one wrong and the content sits under a system bar rather than beside it.
   */
  viewportFit: "cover",
};

/**
 * The colour goes on the document itself rather than on a wrapper inside the app.
 *
 * Sheets and the three-dot panel are drawn through a portal into <body>, which is
 * outside any wrapper the app renders: a theme scoped to one would leave every dialog
 * in the colours of whichever home was open before. It is also why this layout reads
 * the session at all — the session is cached per request, so the app layout below asking
 * for it again costs nothing, and the pages outside a home (login, an invite) simply
 * find nobody and wear the app's own colours.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en" data-theme={user?.homeTheme ?? DEFAULT_THEME}>
      {/* The page's own colour is in globals.css, beside the band the canvas behind it
          wears: the two are a pair, and a class here would put half of it elsewhere. */}
      <body className="min-h-screen text-slate-900 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
