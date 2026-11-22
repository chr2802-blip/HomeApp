import { ReminderStatus } from "@/components/reminder-status";
import { StorageUsage } from "@/components/storage-usage";
import { AiSpendUsage } from "@/components/ai-spend";
import { settingsHome } from "@/lib/settings-home";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/**
 * Settings' readings rather than settings: whether reminders are arriving, where the
 * household's space is going, and how much of this month's AI allowance is spent. There
 * is nothing on this tab to change, only something to notice — which is why it is a tab
 * of its own rather than in among the forms.
 */
export default async function SettingsStatusPage() {
  const { user, home } = await settingsHome();
  if (!home) return null;
  const say = sayIn(user.homeLanguage);

  return (
    <>
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.remindersHeading)}
        </h2>
        <ReminderStatus homeId={home.id} language={user.homeLanguage} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.storageHeading)}
        </h2>
        <StorageUsage homeId={home.id} language={user.homeLanguage} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">
          {say(SETTINGS.aiSpendingHeading)}
        </h2>
        <AiSpendUsage homeId={home.id} language={user.homeLanguage} />
      </section>
    </>
  );
}
