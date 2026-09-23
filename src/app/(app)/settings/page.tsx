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
import { StorageUsage } from "@/components/storage-usage";
import { AiSpendUsage } from "@/components/ai-spend";
import { RecipeCategoriesAdmin } from "@/components/recipe-categories-admin";
import { readInZone } from "@/lib/time";
import { DATE } from "@/lib/copy/dates";
import { ItemMenu } from "@/components/item-menu";
import { PhotoAvatar } from "@/components/photo";
import { PhotoField } from "@/components/photo-field";
import { ThemeField } from "@/components/theme-field";
import { LanguageField } from "@/components/language-field";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";
import { RECIPES } from "@/lib/copy/recipes";

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
  const say = sayIn(user.homeLanguage);

  if (!user.homeId) {
    return (
      <>
        <PageHeader title={say(SETTINGS.title)} />
        <EmptyState>
          <p>{say(SETTINGS.selectAHomeFirst)}</p>
          <ButtonLink href="/admin/homes" className="mt-4">
            {say(SETTINGS.manageHomes)}
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

  if (!home) return <EmptyState>{say(SETTINGS.homeNotFound)}</EmptyState>;

  return (
    <>
      <PageHeader title={say(SETTINGS.title)} description={say(SETTINGS.managing, { home: home.name })} />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">{say(SETTINGS.homeHeading)}</h2>
        <Card>
          <ActionForm
            action={updateHome}
            submitLabel={say(SETTINGS.saveHome)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="homeId" value={home.id} />
            <div className="space-y-1">
              <Label htmlFor="name">{say(SETTINGS.homeName)}</Label>
              <Input id="name" name="name" defaultValue={home.name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="address">{say(SETTINGS.address)}</Label>
              <Input id="address" name="address" defaultValue={home.address ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <PhotoField
                defaultPhotoId={home.photoId}
                label={say(SETTINGS.homePicture)}
                hint={say(SETTINGS.homePictureHint)}
              />
            </div>
            {/* The colour belongs with the name and the picture: all three are what this
                household looks like, and all three are saved by the one button. */}
            <div className="sm:col-span-2">
              <ThemeField defaultTheme={home.theme} />
            </div>
            {/* The language belongs here too, for the same reason: it is what this
                household sounds like, and it is saved by the same button as the rest of
                what it looks like. */}
            <div className="sm:col-span-2">
              <LanguageField defaultLanguage={home.language} />
            </div>
          </ActionForm>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.remindersHeading)}
        </h2>
        <ReminderStatus homeId={home.id} language={user.homeLanguage} />
      </section>

      {/* Where the household's space is going. It sits under Reminders rather than
          beside the name and the picture because it is a reading rather than a setting:
          there is nothing on it to change, only something to notice — usually that the
          recipes somebody photographed are most of the home. */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.storageHeading)}
        </h2>
        <StorageUsage homeId={home.id} language={user.homeLanguage} />
      </section>

      {/* Also a reading rather than a setting, beside Storage for the same reason: how
          much of this month's 5 USD the household's imports have spent so far. */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.aiSpendingHeading)}
        </h2>
        <AiSpendUsage homeId={home.id} language={user.homeLanguage} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.membersHeading)}
        </h2>
        <Card className="divide-y divide-slate-100 p-0">
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
          <Card className="mt-3 divide-y divide-slate-100 p-0">
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

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(RECIPES.recipeCategoriesHeading)}
        </h2>
        <RecipeCategoriesAdmin homeId={home.id} language={user.homeLanguage} />
      </section>
    </>
  );
}
