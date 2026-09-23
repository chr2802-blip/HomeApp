"use client";

import type { HomeLanguage } from "@prisma/client";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { AUTH } from "@/lib/copy/auth";

export function LoginForm({ language }: { language: HomeLanguage }) {
  const [state, formAction, pending] = useActionState(login, undefined);
  const say = sayIn(language);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">{say(AUTH.email)}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">{say(AUTH.password)}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? say(AUTH.loggingIn) : say(AUTH.logIn)}
        </Button>
      </form>
    </Card>
  );
}
