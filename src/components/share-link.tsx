"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { SETTINGS } from "@/lib/copy/settings";

/**
 * A freshly made invitation link, with copy and share. The server only knows the path:
 * the address in front of it is wherever the admin is looking at the app.
 */
export function ShareLink({ path, homeName }: { path: string; homeName: string }) {
  const say = sayIn(useLanguage());
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
    setCanShare(typeof navigator.share === "function");
    setCopied(false);
  }, [path]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard (an old browser, or no permission): the field is selectable.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: say(SETTINGS.shareTitle, { home: homeName }), url });
    } catch {
      // Cancelled.
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-medium text-emerald-900">{say(SETTINGS.linkReady)}</p>
      <Input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={say(SETTINGS.invitationLink)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>
          {copied ? say(SETTINGS.copied) : say(SETTINGS.copyLink)}
        </Button>
        {canShare && (
          <Button type="button" variant="secondary" onClick={share}>
            {say(SETTINGS.shareLink)}
          </Button>
        )}
      </div>
    </div>
  );
}
