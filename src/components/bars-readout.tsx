"use client";

import { useEffect, useState } from "react";

/**
 * The numbers that decide how the household's colour can reach the phone's own bars.
 *
 * `env(safe-area-inset-*)` cannot be read from JavaScript, so it is measured the only
 * way there is: a hidden element is given the inset as padding and its computed padding
 * is read back. A top inset above zero means the document extends under the status bar
 * and the band paints it. Zero means the system draws that strip itself, from the colour
 * baked into the installed app, and nothing the page says can move it.
 */
type Reading = { label: string; value: string };

function measure(): Reading[] {
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.paddingTop = "env(safe-area-inset-top)";
  probe.style.paddingRight = "env(safe-area-inset-right)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom)";
  probe.style.paddingLeft = "env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const inset = getComputedStyle(probe);
  const insets = {
    top: inset.paddingTop,
    right: inset.paddingRight,
    bottom: inset.paddingBottom,
    left: inset.paddingLeft,
  };
  probe.remove();

  const mode =
    (["standalone", "fullscreen", "minimal-ui", "browser"] as const).find((candidate) =>
      window.matchMedia(`(display-mode: ${candidate})`).matches,
    ) ?? "unknown";

  const header = document.querySelector("header");
  const headerPaint = header ? getComputedStyle(header) : null;

  return [
    { label: "display-mode", value: mode },
    { label: "inset top", value: insets.top },
    { label: "inset bottom", value: insets.bottom },
    { label: "inset left / right", value: `${insets.left} / ${insets.right}` },
    {
      label: "meta theme-color",
      value:
        document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ??
        "(none)",
    },
    {
      label: "theme-color tags",
      value: String(document.querySelectorAll('meta[name="theme-color"]').length),
    },
    {
      label: "viewport",
      value:
        document.querySelector('meta[name="viewport"]')?.getAttribute("content") ??
        "(none)",
    },
    { label: "data-theme", value: document.documentElement.dataset.theme ?? "(none)" },
    {
      label: "--band",
      value: getComputedStyle(document.documentElement).getPropertyValue("--band").trim(),
    },
    { label: "header background", value: headerPaint?.backgroundColor ?? "(no header)" },
    { label: "header padding-top", value: headerPaint?.paddingTop ?? "(no header)" },
    {
      label: "window / screen height",
      value: `${window.innerHeight} / ${window.screen.height}`,
    },
    { label: "devicePixelRatio", value: String(window.devicePixelRatio) },
    { label: "user agent", value: navigator.userAgent },
  ];
}

export function BarsReadout() {
  const [readings, setReadings] = useState<Reading[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Measured after paint, because every one of these is a fact about the rendered
  // document rather than about the markup the server sent.
  useEffect(() => setReadings(measure()), []);

  if (!readings) return <p className="text-sm text-slate-500">Measuring…</p>;

  const asText = readings.map((r) => `${r.label}: ${r.value}`).join("\n");

  return (
    <div className="space-y-4">
      <dl className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        {readings.map((reading) => (
          <div
            key={reading.label}
            className="flex flex-col gap-0.5 border-b border-slate-100 px-4 py-2.5 last:border-b-0"
          >
            <dt className="text-xs font-medium text-slate-500">{reading.label}</dt>
            <dd className="font-mono text-[13px] break-all text-slate-900">
              {reading.value}
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        className="pressable w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-medium text-white active:scale-95"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(asText);
            setCopied(true);
          } catch {
            // Clipboard access can be refused outright; the text is on screen regardless.
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
