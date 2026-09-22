"use client";

import { useActionState } from "react";
import { createInvite } from "@/app/actions/admin";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

export function InviteForm({ homeId }: { homeId: string }) {
  const [state, formAction, pending] = useActionState(createInvite, undefined);
  const say = sayIn(useLanguage());

  return (
    <Card>
      <form action={formAction} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <input type="hidden" name="homeId" value={homeId} />
        <div className="space-y-1">
          <Label htmlFor="invite-email">{say(SETTINGS.emailToInvite)}</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">{say(SETTINGS.role)}</Label>
          <Select id="invite-role" name="role" defaultValue="USER">
            <option value="USER">{say(SETTINGS.userRole)}</option>
            <option value="ADMIN">{say(SETTINGS.adminRole)}</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? say(SETTINGS.creating) : say(SETTINGS.createInvite)}
        </Button>
      </form>

      {state?.ok === false && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      {state?.ok && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            {say(SETTINGS.invitationReadyFor, { email: state.email })}
          </p>
          <p className="mt-2 font-mono text-2xl tracking-widest text-emerald-900">{state.code}</p>
          <p className="mt-2 text-xs text-emerald-800">{say(SETTINGS.sendCodeYourself)}</p>
        </div>
      )}
    </Card>
  );
}
