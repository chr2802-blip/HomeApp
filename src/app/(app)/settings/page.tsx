import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { canAdministerHome } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { homeDb } from "@/lib/home-db";
import { removeMember, revokeInvite, updateHome, updateMemberRole } from "@/app/actions/admin";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";
import { InviteForm } from "@/components/invite-form";
import { ActionForm } from "@/components/action-form";
import { ReminderStatus } from "@/components/reminder-status";
import { RecipeCategoriesAdmin } from "@/components/recipe-categories-admin";
import { formatInZone } from "@/lib/time";
import { ItemMenu } from "@/components/item-menu";
import { PhotoAvatar } from "@/components/photo";
import { PhotoField } from "@/components/photo-field";
import { ThemeField } from "@/components/theme-field";

/**
 * Running one household: its name and picture, who is in it, who is invited, what its
 * recipes are filed under, and whether its reminders are arriving.
 *
 * All of it is about this home rather than about the installation, which is why it is
 * reached from the home's own name in the header rather than from a tab. What is about
 * the person doing it — their name, their picture, their notifications — is their
 * profile, one entry above this in the same menu.
 */
export default async function SettingsPage() {
  const user = await requireAdmin();

  if (!user.homeId) {
    return (
      <>
        <PageHeader title="Settings" />
        <EmptyState>
          <p>Select a home first.</p>
          <ButtonLink href="/admin/homes" className="mt-4">
            Manage homes
          </ButtonLink>
        </EmptyState>
      </>
    );
  }

  const homeId = user.homeId;
  // requireAdmin only says they run *a* home. Running one household is no licence over
  // the next, so the one on screen is checked in its own right.
  if (!canAdministerHome(user, homeId)) redirect("/dashboard");

  const db = homeDb(homeId);

  const [home, members, invites] = await Promise.all([
    prisma.home.findUnique({ where: { id: homeId } }),
    db.homeMember.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, photoId: true } },
      },
    }),
    db.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!home) return <EmptyState>Home not found.</EmptyState>;

  return (
    <>
      <PageHeader title="Settings" description={`Managing ${home.name}`} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Home</h2>
        <Card>
          <ActionForm action={updateHome} submitLabel="Save home" className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="homeId" value={home.id} />
            <div className="space-y-1">
              <Label htmlFor="name">Home name</Label>
              <Input id="name" name="name" defaultValue={home.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" name="address" defaultValue={home.address ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <PhotoField
                defaultPhotoId={home.photoId}
                label="Home picture"
                hint="Shown beside the home's name and across the top of the dashboard."
              />
            </div>
            {/* The colour belongs with the name and the picture: all three are what this
                household looks like, and all three are saved by the one button. */}
            <div className="sm:col-span-2">
              <ThemeField defaultTheme={home.theme} />
            </div>
          </ActionForm>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Reminders</h2>
        <ReminderStatus homeId={home.id} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Members</h2>
        <Card className="divide-y divide-slate-100 p-0">
          {members.map(({ user: member, role }) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {/* Decorative: their name is right beside it. */}
              <PhotoAvatar photoId={member.photoId} alt="" className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {member.name}
                  {member.id === user.id && <span className="text-slate-400"> (you)</span>}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
              {/* The role shown is the one they hold here. A super admin's is not a role
                  in this home at all — it is what they are everywhere — so it is named
                  rather than offered as something to change. */}
              {member.role === "SUPER_ADMIN" || member.id === user.id ? (
                <Badge tone={member.role === "SUPER_ADMIN" ? "green" : "neutral"}>
                  {member.role === "SUPER_ADMIN" ? "super admin" : role.toLowerCase()}
                </Badge>
              ) : (
                <>
                  <form action={updateMemberRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="homeId" value={home.id} />
                    <Select name="role" defaultValue={role}>
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </Select>
                    <Button variant="secondary">Save</Button>
                  </form>
                  {/* The role is changed in place beside this; the menu holds only
                      what cannot be undone. */}
                  <ItemMenu
                    name="userId"
                    id={member.id}
                    label={member.name}
                    deleteAction={removeMember}
                    deleteTitle="Remove member"
                    deleteLabel="Remove"
                    deleteConfirmLabel="Remove"
                    deleteMessage={`Remove ${member.name} from this home? They keep their account and any other homes they are in, and what they have written here stays.`}
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
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Invite someone</h2>
        <InviteForm homeId={home.id} />

        {invites.length > 0 && (
          <Card className="mt-3 divide-y divide-slate-100 p-0">
            {invites.map((invite) => (
              <div key={invite.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-slate-500">
                    {invite.role.toLowerCase()} · expires {formatInZone(invite.expiresAt, "d MMM yyyy")}
                  </p>
                </div>
                <form action={revokeInvite}>
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <Button variant="danger">Revoke</Button>
                </form>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Recipe categories</h2>
        <RecipeCategoriesAdmin homeId={home.id} />
      </section>
    </>
  );
}
