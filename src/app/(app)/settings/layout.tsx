import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { settingsHome } from "@/lib/settings-home";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/**
 * Running one household, as tabs (`SETTINGS_TABS`, drawn by `SectionTabs` above this):
 * the home itself, who is in it, what it files things under, who has done what, and how
 * its reminders, storage and AI spending are doing. Each tab is a page of its own address.
 *
 * All of it is about this home rather than about the installation, which is why it is
 * reached from the home's own name in the header rather than from a tab. What is about
 * the person doing it — their name, their picture, their notifications — is their
 * profile, one entry above this in the same menu.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, home } = await settingsHome();
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
  if (!home) return <EmptyState>{say(SETTINGS.homeNotFound)}</EmptyState>;

  return (
    <>
      <PageHeader title={say(SETTINGS.title)} description={say(SETTINGS.managing, { home: home.name })} />
      {children}
    </>
  );
}
