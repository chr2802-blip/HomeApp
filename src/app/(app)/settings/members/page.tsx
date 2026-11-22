import { homeDb } from "@/lib/home-db";
import { removeMember, revokeInvite, updateMemberRole } from "@/app/actions/admin";
import { Badge, Button, Card, Select } from "@/components/ui";
import { InviteForm } from "@/components/invite-form";
import { ItemMenu } from "@/components/item-menu";
import { PhotoAvatar } from "@/components/photo";
import { readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { settingsHome } from "@/lib/settings-home";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/** Settings' people: who is in this home and what they may do here, and who is invited. */
export default async function SettingsMembersPage() {
  const { user, home } = await settingsHome();
  if (!home) return null;
  const say = sayIn(user.homeLanguage);
  const db = homeDb(home.id);

  const [members, invites] = await Promise.all([
    db.homeMember.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, photoId: true } },
      },
    }),
    db.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.membersHeading)}
        </h2>
        <Card padded={false} className="divide-y divide-slate-100">
          {members.map(({ user: member, role }) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {/* Decorative: their name is right beside it. */}
              <PhotoAvatar photoId={member.photoId} alt="" className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {member.name}
                  {member.id === user.id && <span className="text-slate-400"> {say(SETTINGS.you)}</span>}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
              {/* The role shown is the one they hold here. A super admin's is not a role
                  in this home at all — it is what they are everywhere — so it is named
                  rather than offered as something to change. */}
              {member.role === "SUPER_ADMIN" || member.id === user.id ? (
                <Badge tone={member.role === "SUPER_ADMIN" ? "green" : "neutral"}>
                  {member.role === "SUPER_ADMIN"
                    ? say(SETTINGS.superAdminRole)
                    : role === "ADMIN"
                      ? say(SETTINGS.adminRole)
                      : say(SETTINGS.userRole)}
                </Badge>
              ) : (
                <>
                  <form action={updateMemberRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="homeId" value={home.id} />
                    <Select name="role" defaultValue={role}>
                      <option value="USER">{say(SETTINGS.userRole)}</option>
                      <option value="ADMIN">{say(SETTINGS.adminRole)}</option>
                    </Select>
                    <Button variant="secondary">{say(SETTINGS.save)}</Button>
                  </form>
                  {/* The role is changed in place beside this; the menu holds only
                      what cannot be undone. */}
                  <ItemMenu
                    name="userId"
                    id={member.id}
                    label={member.name}
                    deleteAction={removeMember}
                    deleteTitle={say(SETTINGS.removeMemberTitle)}
                    deleteLabel={say(SETTINGS.remove)}
                    deleteConfirmLabel={say(SETTINGS.remove)}
                    deleteMessage={say(SETTINGS.removeMemberMessage, { name: member.name })}
                    extraFields={<input type="hidden" name="homeId" value={home.id} />}
                    className="-mr-2"
                  />
                </>
              )}
            </div>
          ))}
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.inviteSomeoneHeading)}
        </h2>
        <InviteForm homeId={home.id} />

        {invites.length > 0 && (
          <Card padded={false} className="mt-3 divide-y divide-slate-100">
            {invites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-slate-500">
                    {invite.role === "ADMIN" ? say(SETTINGS.adminRole) : say(SETTINGS.userRole)} ·{" "}
                    {say(SETTINGS.expires, {
                      date: readInZone(invite.expiresAt, DATE.dayMonthYear, user.homeLanguage),
                    })}
                  </p>
                </div>
                <form action={revokeInvite}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <Button variant="danger">{say(SETTINGS.revoke)}</Button>
                </form>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
