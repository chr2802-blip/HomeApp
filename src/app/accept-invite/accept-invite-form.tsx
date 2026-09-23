"use client";

import type { HomeLanguage } from "@prisma/client";
import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";

/**
 * One form for two arrivals: somebody brand new, and somebody who already has an account
 * here joining another home with it.
 *
 * What differs is what the password means — one is chosen, the other is the one they
 * already have — so the wording follows whoever is filling it in rather than asking
 * everybody to work out which sentence is theirs.
 */
export function AcceptInviteForm({
  account,
  language,
}: {
  /** The signed-in person, or null for a visitor with no account yet. */
  account: { email: string; name: string } | null;
  language: HomeLanguage;
}) {
  const [state, formAction, pending] = useActionState(acceptInvite, undefined);
  const say = sayIn(language);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">{say(AUTH.invitedEmail)}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={account?.email}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="code">{say(AUTH.invitationCode)}</Label>
          <Input
            id="code"
            name="code"
            // eslint-disable-next-line no-restricted-syntax -- a format example, not prose
            placeholder="XXXX-XXXX"
            autoComplete="one-time-code"
            required
          />
        </div>
        {account ? (
          // Their name is already known and is not changed by joining a home.
          <input type="hidden" name="name" value={account.name} />
        ) : (
          <div className="space-y-1">
            <Label htmlFor="name">{say(AUTH.yourName)}</Label>
            <Input id="name" name="name" required />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="password">{account ? say(AUTH.yourPassword) : say(AUTH.choosePassword)}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={account ? "current-password" : "new-password"}
            minLength={8}
            required
          />
          <p className="text-xs text-slate-500">
            {account ? say(AUTH.passwordOnAccountHint) : say(AUTH.newPasswordHint)}
          </p>
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? say(AUTH.joining) : account ? say(AUTH.joinHome) : say(AUTH.createAccount)}
        </Button>
      </form>
    </Card>
  );
}
