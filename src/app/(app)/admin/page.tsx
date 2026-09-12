import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  removeMember,
  revokeInvite,
  updateHome,
  updateMemberRole,
  updateOwnProfile,
} from "@/app/actions/admin";
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
import { formatInZone } from "@/lib/time";
import { ConfirmButton } from "@/components/confirm-button";
import { TestPushButton } from "@/components/notification-setup";

export default async function AdminPage() {
  const user = await requireAdmin();

  if (!user.homeId) {
    return (
      <>
        <PageHeader title="Administration" />
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
  const [home, members, invites] = await Promise.all([
    prisma.home.findUnique({ where: { id: homeId } }),
    prisma.user.findMany({ where: { homeId }, orderBy: { createdAt: "asc" } }),
    prisma.invite.findMany({
      where: { homeId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!home) return <EmptyState>Home not found.</EmptyState>;

  return (
    <>
      <PageHeader
        title="Administration"
        description={`Managing ${home.name}`}
        action={
          user.role === "SUPER_ADMIN" ? (
            <ButtonLink href="/admin/homes" variant="secondary">
              All homes
            </ButtonLink>
          ) : undefined
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Home</h2>
        <Card>
          <form action={updateHome} className="grid gap-4 sm:grid-cols-2">
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
              <Button type="submit">Save home</Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Members</h2>
        <Card className="divide-y divide-slate-100 p-0">
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {member.name}
                  {member.id === user.id && <span className="text-slate-400"> (you)</span>}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
              {member.role === "SUPER_ADMIN" || member.id === user.id ? (
                <Badge tone={member.role === "SUPER_ADMIN" ? "green" : "neutral"}>
                  {member.role.replace("_", " ").toLowerCase()}
                </Badge>
              ) : (
                <>
                  <form action={updateMemberRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={member.id} />
                    <Select name="role" defaultValue={member.role}>
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </Select>
                    <Button variant="secondary">Save</Button>
                  </form>
                  <form action={removeMember}>
                    <input type="hidden" name="userId" value={member.id} />
                    <ConfirmButton message={`Remove ${member.name} from this home?`}>
                      Remove
                    </ConfirmButton>
                  </form>
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
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Your account</h2>
        <Card className="space-y-4">
          <form action={updateOwnProfile} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" name="name" defaultValue={user.name} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-password">New password</Label>
              <Input
                id="profile-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Leave blank to keep"
                minLength={8}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Update account</Button>
            </div>
          </form>
          <div className="border-t border-slate-100 pt-4">
            <TestPushButton />
          </div>
        </Card>
      </section>
    </>
  );
}
