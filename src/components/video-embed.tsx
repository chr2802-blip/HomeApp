"use client";

import { useEffect, useState } from "react";
import type { Embed } from "@/lib/embed";

const PROVIDER_NAME = { instagram: "Instagram", facebook: "Facebook" } as const;

/**
 * How long to wait before offering the "open on Instagram/Facebook" link beside the
 * loading state. An iframe's load event fires once Meta's page has rendered something —
 * which includes their own "this post isn't available here" fallback — so it is not a
 * success signal, only a sign that the wait is presumably over.
 */
const SLOW_MS = 8000;

export function VideoEmbed({
  embed,
  title,
  originalHref,
}: {
  embed: Embed;
  title: string;
  originalHref: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  if (!embed.fixed) {
    return (
      <div
        className={`relative mx-auto w-full ${embed.aspect === "vertical" ? "max-w-sm" : ""}`}
        style={{ aspectRatio: embed.aspect === "vertical" ? "9 / 16" : "16 / 9" }}
      >
        <iframe
          src={embed.src}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        />
      </div>
    );
  }

  const { provider, width, height } = embed.fixed;
  const providerName = PROVIDER_NAME[provider];

  return (
    <div>
      <div
        className="relative mx-auto bg-slate-50"
        style={{ width, maxWidth: "100%", aspectRatio: `${width} / ${height}` }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <span>Loading…</span>
            {slow && originalHref && (
              <a href={originalHref} target="_blank" rel="noopener noreferrer" className="underline">
                Taking a while — open on {providerName} instead
              </a>
            )}
          </div>
        )}
        <iframe
          src={embed.src}
          title={title}
          scrolling="no"
          allowTransparency={provider === "instagram"}
          className="absolute inset-0 h-full w-full border-0"
          style={{ visibility: loaded ? "visible" : "hidden" }}
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen={provider === "facebook"}
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <p className="px-3 py-2 text-center text-xs text-slate-400">
        A reel with restricted audio, or set to private, may fall back to {providerName}&apos;s own
        &quot;Watch on {providerName}&quot; prompt here rather than playing directly.
      </p>
    </div>
  );
}
