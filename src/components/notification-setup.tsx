"use client";

import { useEffect, useState } from "react";
import { saveSubscription, sendTestPush } from "@/app/actions/push";
import { Button, Card } from "@/components/ui";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type Status = "loading" | "unsupported" | "unconfigured" | "off" | "on" | "blocked";

export function NotificationSetup() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (!vapid) {
      setStatus("unconfigured");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("blocked");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "on" : "off"))
      .catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
        ),
      });
      const json = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await saveSubscription({ endpoint: json.endpoint, keys: json.keys });
      setStatus("on");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unconfigured" || status === "on") return null;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-slate-300 bg-slate-100">
      <div>
        <p className="font-medium">Task reminders</p>
        <p className="text-sm text-slate-600">
          {status === "blocked"
            ? "Notifications are blocked for this site — enable them in your browser settings."
            : status === "unsupported"
              ? "This browser can't show push notifications."
              : "Turn on notifications to be reminded when a recurring task is due."}
        </p>
      </div>
      {status === "off" && (
        <Button onClick={enable} disabled={busy}>
          {busy ? "Enabling…" : "Enable notifications"}
        </Button>
      )}
    </Card>
  );
}

export function TestPushButton() {
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        onClick={async () => {
          const delivered = await sendTestPush();
          setResult(delivered > 0 ? "Sent." : "No active subscription on this account.");
        }}
      >
        Send test notification
      </Button>
      {result && <span className="text-sm text-slate-500">{result}</span>}
    </div>
  );
}
