"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";

export function AcceptInviteForm() {
  const [state, formAction, pending] = useActionState(acceptInvite, undefined);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Invited email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="code">Invitation code</Label>
          <Input
            id="code"
            name="code"
            placeholder="XXXX-XXXX"
            autoComplete="one-time-code"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">Choose a password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="text-xs text-slate-500">At least 8 characters.</p>
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
