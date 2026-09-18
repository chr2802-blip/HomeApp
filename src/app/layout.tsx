import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { getCurrentUser } from "@/lib/auth";
import { BAND, DEFAULT_THEME } from "@/lib/theme";
import "./globals.css";

/**
 * The rounded, friendly face on headings and titles — the one thing that makes every
 * screen look like the same generic system-font app before this. Only headings: body
 * text stays the platform's own sans, which is what stays legible and dense in a list
 * of ingredients or a row of tasks. Exposed as a variable rather than set directly, so
 * globals.css decides where it actually lands.
 */
const heading = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HomeHub",
  description: "Lists, recurring tasks and recipes for your home.",
  manifest: "/manifest.webmanifest",
  /*
   * Installed from Safari, the app runs with no chrome of its own and the strip above it
   * holds the clock and the battery. `default` is what puts the phone's own dark glyphs
   * there, which is the only readable choice against the band — a pale tint, and the
   * translucent style would hand the strip to the app and leave those glyphs white on
   * near-white. What it is painted with is the document's background, which carries the
   * band from globals.css, so the strip is right on iOS without anything here being told
   * a colour.
   */
  appleWebApp: { capable: true, title: "HomeHub", statusBarStyle: "default" },
};

/**
 * The strip above the header, and who paints it.
 *
 * A tab's toolbar continues the app rather than sitting on top of it, and on Android
 * this is also what an installed app's status bar is tinted with at launch. It is the
 * only one of the band's painters that has to be told the colour in words — the header,
 * the tab bar and the document behind them all read `--band`, which no longer depends on
 * which home is on screen, so this no longer needs the session to say which literal to
 * use.
 *
 * On iOS an installed app ignores this and paints the strip from the document's
 * background instead, which carries the same band.
 */
export function generateViewport(): Viewport {
  return {
    themeColor: BAND,
    width: "device-width",
    initialScale: 1,
    /*
     * The app is laid out to the edges of the screen, under the phone's own bars.
     *
     * Without this the viewport stops above the gesture bar, and the strip the phone
     * draws there is the phone's — painted, on Android, from the manifest at install and
     * from nothing the page can say afterwards. With it the strip is inside the viewport
     * and the tab bar's own band reaches it, so the bottom of the screen is the app's
     * pixels and follows the household like everything else.
     *
     * What it costs is that the layout is now responsible for the insets it just took
     * on: `env(safe-area-inset-*)` is no longer zero, the header pads by the top one and
     * the tab bar by the bottom one, and a form's buttons already did (`ModalFooter`).
     * Get one wrong and the content sits under a system bar rather than beside it.
     */
    viewportFit: "cover",
  };
}

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
    <html lang="en" data-theme={user?.homeTheme ?? DEFAULT_THEME} className={heading.variable}>
      {/* The page's own colour is in globals.css, beside the band the canvas behind it
          wears: the two are a pair, and a class here would put half of it elsewhere. */}
      <body className="min-h-screen text-slate-900 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
