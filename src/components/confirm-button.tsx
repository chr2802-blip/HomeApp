"use client";

import { Button } from "@/components/ui";

export function ConfirmButton({
  message,
  children,
}: {
  message: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="danger"
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
