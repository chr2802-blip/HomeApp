"use client";

import { useActionState } from "react";
import { createInvite } from "@/app/actions/admin";
import { Button, Card, Input, Label, Select } from "@/components/ui";

/**
 * Issuing an invitation, and saying what became of it.
 *
 * The panel afterwards is deliberately the same panel whether the mail went or not:
 * what it holds — the code, and the link that carries it — is what an admin needs in
 * order to pass the invitation on themselves, and they need it most on the day the
 * mail is refused. Only the first line and the hint change, because only the delivery
 * changed; the invitation is real either way.
 */
export function InviteForm({ homeId }: { homeId: string }) {
  const [state, formAction, pending] = useActionState(createInvite, undefined);

  return (
    <Card>
      <form action={formAction} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <input type="hidden" name="homeId" value={homeId} />
        <div className="space-y-1">
          <Label htmlFor="invite-email">Email to invite</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" name="role" defaultValue="USER">
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </form>

      {state?.ok === false && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      {state?.ok && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            {state.sent
              ? `Invitation sent to ${state.email}`
              : `Invitation ready for ${state.email}`}
          </p>

          {!state.sent && state.reason && (
            // Why nothing was sent, not an apology for it: "email is not configured"
            // is a setting somebody has not filled in, and reads as a bug unless it
            // says so.
            <p className="mt-1 text-xs text-emerald-800">
              It could not be emailed. {state.reason}
            </p>
          )}

          <p className="mt-2 font-mono text-2xl tracking-widest text-emerald-900">{state.code}</p>

          {state.link && (
            <p className="mt-2 text-xs break-all text-emerald-800">
              {/* Selectable rather than a link: this is the thing to copy into a
                  message, not somewhere the admin wants to go. */}
              <span className="font-medium">Invitation link</span>{" "}
              <span className="font-mono">{state.link}</span>
            </p>
          )}

          <p className="mt-2 text-xs text-emerald-800">
            {state.sent
              ? "The link fills the form in for them. Pass it on yourself too if the mail does not arrive — it is shown once, so create a new invite if it gets lost."
              : "Send them the link or the code yourself. They sign up using that exact email, and it is shown once — create a new invite if it gets lost."}
          </p>
        </div>
      )}
    </Card>
  );
}
