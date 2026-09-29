"use client";

import { useEffect, useState } from "react";
import { sendTestPush } from "@/app/actions/push";
import { readPushState, turnOnPush, type PushState } from "@/lib/push-client";
import { Button, Card } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { DASHBOARD } from "@/lib/copy/dashboard";

type Status = "loading" | PushState;

/**
 * The offer to turn task reminders on, which is also the only place their state is
 * visible. It says nothing on the dashboard once they are on — there is nothing left to
 * ask for — but the profile page passes `showEnabled`, because a page *about* your
 * notifications that goes blank when they work reads as a page that is broken.
 */
export function NotificationSetup({ showEnabled = false }: { showEnabled?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const say = sayIn(useLanguage());

  useEffect(() => {
    readPushState().then(setStatus);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      setStatus(await turnOnPush());
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unconfigured") return null;

  if (status === "on") {
    if (!showEnabled) return null;
    return (
      <Card className="border-slate-300 bg-slate-100">
        <p className="font-medium">{say(DASHBOARD.taskReminders)}</p>
        <p className="text-sm text-slate-600">{say(DASHBOARD.remindersOn)}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-slate-300 bg-slate-100">
      <div>
        <p className="font-medium">{say(DASHBOARD.taskReminders)}</p>
        <p className="text-sm text-slate-600">
          {status === "blocked"
            ? say(DASHBOARD.notificationsBlocked)
            : status === "unsupported"
              ? say(DASHBOARD.pushUnsupported)
              : say(DASHBOARD.turnOnNotifications)}
        </p>
      </div>
      {status === "off" && (
        <Button onClick={enable} disabled={busy}>
          {busy ? say(DASHBOARD.enabling) : say(DASHBOARD.enableNotifications)}
        </Button>
      )}
    </Card>
  );
}

export function TestPushButton() {
  const [result, setResult] = useState<string | null>(null);
  const say = sayIn(useLanguage());

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        onClick={async () => {
          const delivered = await sendTestPush();
          setResult(delivered > 0 ? say(DASHBOARD.testSent) : say(DASHBOARD.noActiveSubscription));
        }}
      >
        {say(DASHBOARD.sendTestNotification)}
      </Button>
      {result && <span className="text-sm text-slate-500">{result}</span>}
    </div>
  );
}
