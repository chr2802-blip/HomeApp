"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Card, PageHeader } from "@/components/ui";
import { isNotAllowed } from "@/lib/not-allowed";
import { useLanguage } from "@/components/language-provider";
import { APP } from "@/lib/copy/app";
import { sayIn } from "@/lib/copy/say";

/**
 * Catches anything a page or server action throws inside the app shell — most often a
 * permission check on a record belonging to another home. Without this the whole app
 * is replaced by the framework's generic crash page.
 *
 * Which of the two screens it draws is decided by the error's `digest` and never by its
 * message. This used to read `error.message === "Not allowed"`, which worked on a
 * laptop and never once in production: Next replaces a server error's message on its
 * way to the client, so the deployed app told somebody following a stale link to
 * another household that something had gone wrong and that trying again often clears
 * it — advice about a thing that would never work. `digest` is the field that does
 * survive the crossing. See `lib/not-allowed.ts`.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const denied = isNotAllowed(error);
  // Inside the app's own layout, so the household's provider is above this boundary.
  const say = sayIn(useLanguage());

  return (
    <>
      <PageHeader
        title={say(denied ? APP.error.notYourHome : APP.error.somethingWrong)}
        description={say(denied ? APP.error.notYourHomeBody : APP.error.somethingWrongBody)}
      />
      <Card className="flex flex-wrap gap-2">
        {!denied && <Button onClick={reset}>{say(APP.error.tryAgain)}</Button>}
        <ButtonLink href="/dashboard" variant={denied ? "primary" : "secondary"}>
          {say(APP.error.backToDashboard)}
        </ButtonLink>
      </Card>
    </>
  );
}
