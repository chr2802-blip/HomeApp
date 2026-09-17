import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_THEME, THEME_BAR } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeHub",
  description: "Lists, recurring tasks and recipes for your home.",
  manifest: "/manifest.webmanifest",
  /*
   * Installed from Safari, the app runs with no chrome of its own and the strip above it
   * holds the clock and the battery. `default` is what puts the phone's own dark glyphs
   * there, which is the only readable choice against six pale bands — the translucent
   * style would hand the strip to the app and turn those glyphs white. What it is
   * painted with is the document's background, set from the home's band in globals.css.
   */
  appleWebApp: { capable: true, title: "HomeHub", statusBarStyle: "default" },
};

/**
 * The browser's own chrome, above the header.
 *
 * Worked out per request rather than declared once, so it is the colour of the home
 * being read: left fixed it stays one colour while the header underneath it changes
 * with the household, which reads as a mistake rather than as a border.
 *
 * This is the colour a browser tints its address bar with. An installed app has no
 * address bar and takes its status bar from the document's background instead, which is
 * why `html` carries the same band in globals.css — the tag alone left the strip on a
 * home screen app the colour of the page. Both are the header's own flat colour, so
 * whichever of them a phone uses, the top of the screen is one bar.
 *
 * `getCurrentUser` is cached per request, so this and the layout below share the one
 * lookup, and somebody on the login page finds nobody and gets the app's own colour.
 */
export async function generateViewport(): Promise<Viewport> {
  const user = await getCurrentUser();

  return {
    themeColor: THEME_BAR[user?.homeTheme ?? DEFAULT_THEME],
    width: "device-width",
    initialScale: 1,
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
