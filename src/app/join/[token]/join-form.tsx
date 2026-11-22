"use client";

import type { HomeLanguage } from "@prisma/client";
import { useActionState } from "react";
import { joinWithLink, joinWithLinkAsMe } from "@/app/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";

/** A visitor with no session: their name, email and password, and they are in. */
export function JoinForm({ token, language }: { token: string; language: HomeLanguage }) {
  const [state, formAction, pending] = useActionState(joinWithLink, undefined);
  const say = sayIn(language);
  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div className="space-y-1">
          <Label htmlFor="name">{say(AUTH.yourName)}</Label>
          <Input id="name" name="name" autoComplete="name" required maxLength={100} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">{say(AUTH.email)}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">{say(AUTH.password)}</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <p className="text-xs text-slate-500">{say(AUTH.joinPasswordHint)}</p>
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? say(AUTH.joining) : say(AUTH.joinAndCreate)}
        </Button>
      </form>
    </Card>
  );
}

/** Somebody already logged in: one press, and the home joins the ones they are in. */
export function JoinAsMeForm({
  token,
  homeName,
  language,
}: {
  token: string;
  homeName: string;
  language: HomeLanguage;
}) {
  const [state, formAction, pending] = useActionState(joinWithLinkAsMe, undefined);
  const say = sayIn(language);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? say(AUTH.oneMoment) : say(AUTH.goToHome, { home: homeName })}
      </Button>
    </form>
  );
}
