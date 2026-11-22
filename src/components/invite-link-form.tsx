"use client";

import { Button, Card, Label, Select } from "@/components/ui";
import { ShareLink } from "@/components/share-link";
import { useFormAction } from "@/components/use-form-action";
import { useLanguage } from "@/components/language-provider";
import { createInviteLink } from "@/app/actions/admin";
import {
  DEFAULT_LINK_DAYS,
  DEFAULT_LINK_MAX_USES,
  isJoinPath,
  LINK_DAYS,
  LINK_MAX_USES,
} from "@/lib/invite-link-options";
import { sayIn } from "@/lib/copy/say";
import { LINK_COUNTS, SETTINGS } from "@/lib/copy/settings";

/** Making an invitation link: how long it lasts, how many it lets in, and then the link. */
export function InviteLinkForm({ homeId, homeName }: { homeId: string; homeName: string }) {
  const { state, pending, handleSubmit } = useFormAction(createInviteLink);
  const say = sayIn(useLanguage());

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-500">{say(SETTINGS.inviteExplainer)}</p>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="homeId" value={homeId} />
        <div className="space-y-1">
          <Label htmlFor="link-days">{say(SETTINGS.linkValidFor)}</Label>
          <Select id="link-days" name="days" defaultValue={String(DEFAULT_LINK_DAYS)}>
            {LINK_DAYS.map((days) => (
              <option key={days} value={days}>
                {say(LINK_COUNTS.days, { count: days })}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="link-uses">{say(SETTINGS.linkMaxPeople)}</Label>
          <Select id="link-uses" name="maxUses" defaultValue={String(DEFAULT_LINK_MAX_USES)}>
            {LINK_MAX_USES.map((uses) => (
              <option key={uses} value={uses}>
                {say(LINK_COUNTS.people, { count: uses })}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending} aria-busy={pending}>
            {pending ? say(SETTINGS.makingLink) : say(SETTINGS.makeInviteLink)}
          </Button>
          {state?.ok === false && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
        </div>
      </form>
      {state?.ok && isJoinPath(state.note) && <ShareLink path={state.note} homeName={homeName} />}
    </Card>
  );
}
