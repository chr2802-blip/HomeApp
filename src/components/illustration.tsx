/**
 * Little line drawings for a screen with nothing on it yet — a house, a basket, a pot,
 * a mug, a pair of jars — drawn in the home's own colour on a wash of it.
 *
 * Drawn here rather than shipped as images, so they wear `--accent` exactly as the
 * controls do and change colour with the household instead of staying the colour they
 * were exported in. Decoration only: the sentence under each one says everything, so
 * every drawing is `aria-hidden`.
 *
 * Kept deliberately loose — round caps, slightly uneven curves — because a drawing
 * that looks hand-made is what makes an empty screen read as "nothing here yet" rather
 * than as something missing.
 */

export type ArtKind = "home" | "basket" | "pot" | "mug" | "jars";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TINT = "fill-[color-mix(in_srgb,var(--accent)_14%,white)]";

function Home() {
  return (
    <>
      <path d="M14 78h92" {...STROKE} />
      <path className={TINT} d="M28 78V44l32-24 32 24v34z" />
      <path d="M28 78V44l32-24 32 24v34" {...STROKE} />
      <path d="M22 49l38-29 38 29" {...STROKE} />
      <path d="M78 30V18h8v18" {...STROKE} />
      <path d="M82 12c-3-3 3-5 0-8M88 10c-2-2 2-4 0-6" {...STROKE} strokeWidth={2} />
      <path d="M52 78V60a8 8 0 0 1 16 0v18" {...STROKE} />
      <path
        d="M44 44c-2.5-3-7-1-5 2.5l5 4.5 5-4.5c2-3.5-2.5-5.5-5-2.5z"
        fill="currentColor"
        stroke="none"
      />
    </>
  );
}

function Basket() {
  return (
    <>
      <path d="M28 42C28 8 92 8 92 42" {...STROKE} />
      <path className={TINT} d="M68 44l12-24a4.5 4.5 0 0 1 8 4l-11 22z" />
      <path d="M68 44l12-24a4.5 4.5 0 0 1 8 4l-11 22" {...STROKE} />
      <path d="M78 30l4 2M75 36l4 2" {...STROKE} strokeWidth={1.8} />
      <circle className={TINT} cx="45" cy="36" r="9" />
      <circle cx="45" cy="36" r="9" {...STROKE} />
      <path d="M45 27v-4M45 24c3-4 7-4 9-2-3 3-6 3-9 2z" {...STROKE} strokeWidth={2} />
      <path className={TINT} d="M20 42h80l-9 34H29z" />
      <path d="M20 42h80l-9 34H29z" {...STROKE} />
      <path d="M24 53h72M27 64h66" {...STROKE} strokeWidth={1.8} />
    </>
  );
}

function Pot() {
  return (
    <>
      <path d="M46 20c-4-4 4-6 0-11M60 18c-4-4 4-6 0-11M74 20c-4-4 4-6 0-11" {...STROKE} strokeWidth={2} />
      <path d="M34 34h52" {...STROKE} />
      <path d="M56 34v-4h8v4" {...STROKE} />
      <path className={TINT} d="M32 40h56v22a14 14 0 0 1-14 14H46a14 14 0 0 1-14-14z" />
      <path d="M32 40h56v22a14 14 0 0 1-14 14H46a14 14 0 0 1-14-14z" {...STROKE} />
      <path d="M32 46h-8M88 46h8" {...STROKE} />
      <path d="M22 82h76" {...STROKE} />
    </>
  );
}

function Mug() {
  return (
    <>
      <path d="M50 24c-4-5 4-7 0-12M62 24c-4-5 4-7 0-12" {...STROKE} strokeWidth={2} />
      <path className={TINT} d="M38 32h40v30a12 12 0 0 1-12 12H50a12 12 0 0 1-12-12z" />
      <path d="M38 32h40v30a12 12 0 0 1-12 12H50a12 12 0 0 1-12-12z" {...STROKE} />
      <path d="M78 40h5a9 9 0 0 1 0 18h-5" {...STROKE} />
      <path d="M26 80h64" {...STROKE} />
      <path
        d="M58 46c-2.5-3-7-1-5 2.5l5 4.5 5-4.5c2-3.5-2.5-5.5-5-2.5z"
        fill="currentColor"
        stroke="none"
      />
    </>
  );
}

function Jars() {
  return (
    <>
      <path d="M14 78h92" {...STROKE} />
      <path className={TINT} d="M26 40h28v30a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" />
      <path d="M26 40h28v30a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" {...STROKE} />
      <path d="M24 32h32v8H24z" {...STROKE} />
      <path d="M32 54h16v10H32z" {...STROKE} strokeWidth={1.8} />
      <path className={TINT} d="M66 50h26v22a6 6 0 0 1-6 6H72a6 6 0 0 1-6-6z" />
      <path d="M66 50h26v22a6 6 0 0 1-6 6H72a6 6 0 0 1-6-6z" {...STROKE} />
      <path d="M64 43h30v7H64z" {...STROKE} />
      <circle cx="79" cy="63" r="4" {...STROKE} strokeWidth={1.8} />
    </>
  );
}

const ART: Record<ArtKind, () => React.ReactElement> = {
  home: Home,
  basket: Basket,
  pot: Pot,
  mug: Mug,
  jars: Jars,
};

export function Illustration({ kind, className = "" }: { kind: ArtKind; className?: string }) {
  const Drawing = ART[kind];
  return (
    <svg
      viewBox="0 0 120 90"
      aria-hidden="true"
      className={`text-[var(--accent-text)] ${className}`}
    >
      <Drawing />
    </svg>
  );
}
