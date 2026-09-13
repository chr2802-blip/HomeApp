"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Card, PageHeader } from "@/components/ui";

/**
 * Catches anything a page or server action throws inside the app shell — most often a
 * permission check on a record belonging to another home. Without this the whole app
 * is replaced by the framework's generic crash page.
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

  const denied = error.message === "Not allowed";

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
