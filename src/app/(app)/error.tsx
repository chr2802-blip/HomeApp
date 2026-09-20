"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Card, PageHeader } from "@/components/ui";
import { isNotAllowed } from "@/lib/not-allowed";

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

  return (
    <>
      <PageHeader
        title={denied ? "Not your home" : "Something went wrong"}
        description={
          denied
            ? "That belongs to a different home, so it cannot be opened from here."
            : "The page could not be loaded. Trying again often clears it."
        }
      />
      <Card className="flex flex-wrap gap-2">
        {!denied && <Button onClick={reset}>Try again</Button>}
        <ButtonLink href="/dashboard" variant={denied ? "primary" : "secondary"}>
          Back to the dashboard
        </ButtonLink>
      </Card>
    </>
  );
}
