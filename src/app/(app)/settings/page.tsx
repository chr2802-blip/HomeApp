import { updateHome } from "@/app/actions/admin";
import { Card, Input, Label } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { NemligSettings } from "@/components/nemlig-settings";
import { PhotoField } from "@/components/photo-field";
import { ThemeField } from "@/components/theme-field";
import { LanguageField } from "@/components/language-field";
import { SeasonalField } from "@/components/seasonal-field";
import { settingsHome } from "@/lib/settings-home";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/**
 * Connecting Nemlig tries the login against nemlig.com before keeping it, which is
 * several requests to somebody else's server — `NEMLIG_CALL_TIMEOUT_MS` each — and has
 * to fail inside the route rather than be cut off by the platform.
 */
export const maxDuration = 60;

/** Settings' first tab: what this household looks and sounds like, and where it shops. */
export default async function SettingsHomePage() {
  const { user, home } = await settingsHome();
  if (!home) return null;
  const say = sayIn(user.homeLanguage);

  return (
    <>
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
              <ThemeField defaultTheme={home.theme} language={home.language} />
            </div>
            {/* The language belongs here too, for the same reason: it is what this
                household sounds like, and it is saved by the same button as the rest of
                what it looks like. */}
            <div className="sm:col-span-2">
              <LanguageField defaultLanguage={home.language} />
            </div>
            <div className="sm:col-span-2">
              <SeasonalField defaultOn={home.seasonal} language={home.language} />
            </div>
          </ActionForm>
        </Card>
      </section>

      {/* Beside the home itself: which shop the household fills a basket at is part of
          setting the household up. */}
      <NemligSettings homeId={home.id} language={user.homeLanguage} />
    </>
  );
}
