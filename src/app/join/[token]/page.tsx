import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { findInviteLink, linkProblem } from "@/lib/invite-links";
import { DEFAULT_LANGUAGE } from "@/lib/language";
import { Card } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";
import { LanguageProvider } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";
import { APP } from "@/lib/copy/app";
import { JoinAsMeForm, JoinForm } from "./join-form";

// The token is in the address: keep the page out of search engines and the token out of
// the Referer header of anything it links to.
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Opening an invitation link. Only showing the page uses up nothing — chat apps fetch a
 * link to draw its preview — a place is taken only when the form is sent.
 *
 * The page speaks the language of the home it invites into and wears its colour, since
 * that is the household being joined; a dead link falls back to the visitor's own.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [link, user] = await Promise.all([findInviteLink(token), getCurrentUser()]);
  const problem = linkProblem(link);
  const language = link?.home.language ?? user?.homeLanguage ?? DEFAULT_LANGUAGE;
  const say = sayIn(language);
  const open = link && !problem ? link : null;

  return (
    <LanguageProvider language={language}>
      <div
        data-theme={open?.home.theme}
        className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10"
      >
        <div className="mb-6">
          {open ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {say(AUTH.joinHomeTitle, { home: open.home.name })}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{say(AUTH.joinHomeHint)}</p>
            </>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight">{say(AUTH.invitation)}</h1>
          )}
        </div>

        {!open ? (
          <Card>
            <p role="alert" className="text-sm text-slate-700">
              {say(
                problem === "expired" ? AUTH.linkExpired : problem === "usedUp" ? AUTH.linkUsedUp : AUTH.linkUnknown,
              )}
            </p>
          </Card>
        ) : user ? (
          <Card className="space-y-4">
            <p className="text-sm text-slate-700">
              {user.homes.some((home) => home.id === open.homeId)
                ? say(AUTH.alreadyInThisHome, { home: open.home.name })
                : say(AUTH.loggedInAs, { name: user.name })}
            </p>
            <JoinAsMeForm token={token} homeName={open.home.name} language={language} />
            <div className="flex items-center justify-center gap-1 text-sm text-slate-500">
              {say(AUTH.notYou)} <LogoutButton label={say(APP.logOut)} />
            </div>
          </Card>
        ) : (
          <JoinForm token={token} language={language} />
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="press-text tap-inline font-medium text-slate-900 underline">
            {say(AUTH.toLogin)}
          </Link>
        </p>
      </div>
    </LanguageProvider>
  );
}
