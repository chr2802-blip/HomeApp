import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_THEME, THEME_BAR } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeHub",
  description: "Lists, recurring tasks and recipes for your home.",
  manifest: "/manifest.webmanifest",
};

/**
 * The phone's own status bar, above the header.
 *
 * Worked out per request rather than declared once, so it is the colour of the home
 * being read: installed on a phone the app has no address bar of its own, and that strip
 * is the top of the screen. Left fixed it stays one colour while the header underneath
 * it changes with the household, which reads as a mistake rather than as a border.
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
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
