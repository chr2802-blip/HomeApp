export type Embed = {
  src: string;
  aspect: "vertical" | "wide";
  /**
   * Instagram and Facebook don't hand back a plain video element — their iframes are a
   * fixed-size widget (their own header/footer chrome included) rather than something
   * that reflows to fill an aspect-ratio box the way YouTube's or Vimeo's does. `width`
   * and `height` are the box Meta's own embed widgets expect to be given, not a crop:
   * there is no parameter that leaves their chrome off, so the recipe page shows it as
   * Meta renders it and says so underneath, rather than trying to hide what can't
   * reliably be hidden.
   */
  fixed?: { provider: "instagram" | "facebook"; width: number; height: number };
};

const INSTAGRAM_SIZE = { width: 380, height: 600 };
const FACEBOOK_SIZE = { width: 380, height: 680 };

/**
 * Query parameters that only ever carry where a link was shared from, never which post
 * it points at — the kind a share sheet appends on its own. Stripped rather than kept
 * because Facebook's video plugin is handed this string verbatim as the post it should
 * play, and a post's own identifying parameters (a `?v=` on a /watch/ link, say) must
 * survive that a tracking tag must not.
 */
const TRACKING_PARAMS = [
  "igsh",
  "igshid",
  "mibextid",
  "ref",
  "ref_src",
  "ref_url",
  "fbclid",
  "__tn__",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
];

/** The link with its tracking noise and trailing slash gone, everything else kept. */
function cleanUrl(url: URL): string {
  const cleaned = new URL(url.toString());
  for (const param of TRACKING_PARAMS) cleaned.searchParams.delete(param);
  cleaned.hash = "";
  cleaned.pathname = cleaned.pathname.replace(/\/+$/, "") || "/";
  return cleaned.toString();
}

/**
 * Only hosts on this allowlist are ever turned into an iframe, and the embed URL is
 * rebuilt from parsed parts rather than interpolated, so a hostile link cannot smuggle
 * script or markup into the page.
 */
export function toEmbed(rawUrl: string | null | undefined): Embed | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host === "instagr.am") {
    const kindIndex = segments.findIndex((s) => s === "reel" || s === "reels" || s === "p" || s === "tv");
    const kind = segments[kindIndex] === "reels" ? "reel" : segments[kindIndex];
    const code = kindIndex >= 0 ? segments[kindIndex + 1] : undefined;
    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    return {
      src: `https://www.instagram.com/${kind}/${code}/embed/`,
      aspect: "vertical",
      fixed: { provider: "instagram", ...INSTAGRAM_SIZE },
    };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = segments[0] === "shorts" || segments[0] === "embed" ? segments[1] : url.searchParams.get("v");
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return { src: `https://www.youtube.com/embed/${id}`, aspect: segments[0] === "shorts" ? "vertical" : "wide" };
  }

  if (host === "youtu.be") {
    const id = segments[0];
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return { src: `https://www.youtube.com/embed/${id}`, aspect: "wide" };
  }

  if (host === "tiktok.com") {
    const videoIndex = segments.indexOf("video");
    const id = videoIndex >= 0 ? segments[videoIndex + 1] : undefined;
    if (!id || !/^\d+$/.test(id)) return null;
    return { src: `https://www.tiktok.com/embed/v2/${id}`, aspect: "vertical" };
  }

  if (host === "vimeo.com") {
    const id = segments[0];
    if (!id || !/^\d+$/.test(id)) return null;
    return { src: `https://player.vimeo.com/video/${id}`, aspect: "wide" };
  }

  // Facebook's mobile and desktop-web share sheets hand out m. and web. links for the
  // same posts as www. — normalized here rather than added to the general www.-only
  // strip above, since no other provider on this list uses either.
  const facebookHost = host.replace(/^(m|web)\.facebook\.com$/, "facebook.com");
  if (facebookHost === "facebook.com" || facebookHost === "fb.watch") {
    const embedded = new URL("https://www.facebook.com/plugins/video.php");
    embedded.searchParams.set("href", cleanUrl(url));
    embedded.searchParams.set("show_text", "false");
    embedded.searchParams.set("width", String(FACEBOOK_SIZE.width));
    return {
      src: embedded.toString(),
      aspect: "vertical",
      fixed: { provider: "facebook", ...FACEBOOK_SIZE },
    };
  }

  return null;
}

/** A safe href for "open original" links — never returns a javascript: or data: URL. */
export function safeExternalHref(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
