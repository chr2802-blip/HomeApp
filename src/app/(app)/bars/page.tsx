import { BarsReadout } from "@/components/bars-readout";

/**
 * What this phone is actually doing with the app's frame.
 *
 * A temporary page, reachable only by typing /bars, for settling one question that no
 * test on a desktop can answer: whether an installed app is drawn *under* the phone's
 * status bar — in which case the band paints it and the household's colour reaches it —
 * or beside it, in which case the strip is the system's and wears whatever the manifest
 * said when the app was installed.
 *
 * Delete this once the question is answered. It is a measuring stick, not a feature.
 */
export default function BarsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bars</h1>
      <p className="text-sm text-slate-500">
        What this device reports about the frame. Copy it and send it on.
      </p>
      <BarsReadout />
    </div>
  );
}
