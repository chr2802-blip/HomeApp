import * as cheerio from "cheerio";

/**
 * Where a reel keeps its recipe, and how to get at it without an account.
 *
 * `recipe-extract.ts` gathers a page's `schema.org/Recipe` markup, which every recipe
 * site publishes and no social network does — so a reel taken down that route arrives as
 * a page that loaded perfectly and had almost nothing on it. What a reel has instead is
 * its caption, and for a recipe reel the caption *is* the recipe: whoever posted it wrote
 * the ingredients and the steps under the video because there is nowhere else on that
 * page to put them.
 *
 * This module is the extraction half for that case, and only that: the addresses worth
 * asking, and the reading of what comes back as text. Whether the text is a recipe, and
 * where its ingredients stop and its method begins, is `recipe-normalize.ts`'s to answer —
 * the same reader a web page's text goes to, so a caption means one thing in this app
 * however it arrived. The fetching stays in `recipe-import.ts` with the host checks and
 * the limits every outbound request from a pasted link has to go through. Everything here
 * is pure, so `tests/unit/reel-import.test.ts` holds it against real markup with no
 * network.
 *
 * **None of these addresses is a supported API, and that is the honest position.**
 * Instagram's `/embed/captioned/` is the page its own embed widget loads; TikTok's oEmbed
 * is the one genuinely open endpoint of the three; Meta's actual oEmbed needs an app token
 * this household does not have. So the sources are tried in order and any of them may
 * simply refuse — which is why a failure here is never a dead end but an offer to paste the
 * caption in by hand, the one route nothing can block.
 *
 * **And each address is read three ways, because a page's markup is the part that moves.**
 * The `.Caption` element, then `og:description`, then the post as JSON inlined in the page
 * (`captionFromEmbeddedJson`). The third was added when both Instagram addresses started
 * answering with an application shell holding neither of the first two — so the order is
 * also the order in which each was true, and a source is only given up on once all three
 * have found nothing.
 */

export type CaptionSource = {
  url: string;
  /** `json` is an oEmbed document; `html` is a page to read the caption out of. */
  kind: "html" | "json";
  /**
   * The post's own id, where the address is built around one. Nothing in the reading
   * uses it; the diagnostics do. A body that never mentions the code is an application
   * shell that was never told which post it is for, and that is a different failure
   * from markup that moved — the first cannot be fixed by reading the page better.
   */
  code?: string;
};

/** What was read off a reel's page, before any of it has been understood as a recipe. */
export type ReelCaption = {
  caption: string;
  /** The video's own poster frame, which is the nearest thing a reel has to a photo. */
  imageUrl: string | null;
  /** Whatever the page called itself, for a caption that never names the dish. */
  pageTitle: string;
};

/**
 * Query parameters that only say where a link was shared from. Stripped before a link
 * is handed to one of Meta's own endpoints as the post it should render, which is
 * `embed.ts`'s reasoning for the same list — kept separate from it because that one is
 * about building an iframe `src` for the browser and this is about what this app fetches.
 */
const SHARE_PARAMS = ["igsh", "igshid", "mibextid", "ref", "ref_src", "ref_url", "fbclid", "__tn__"];

function withoutShareParams(url: URL): string {
  const cleaned = new URL(url.toString());
  for (const param of SHARE_PARAMS) cleaned.searchParams.delete(param);
  cleaned.hash = "";
  return cleaned.toString();
}

/**
 * The addresses worth asking for this link's caption, best first, or an empty list for
 * a link that is not a social video at all — which is how `recipe-import.ts` tells the
 * two routes apart without a second opinion about what counts as a reel.
 *
 * Instagram's embed page is asked before the post's own page because it is the one
 * written for a caller with no account: the ordinary page answers a signed-out request
 * with a login wall about half the time, and the embed page carries the whole caption
 * where `og:description` carries a truncated copy of it. Both embed addresses are asked —
 * the reel-shaped one and the `/p/` one — before the post page, because they are cheap and
 * the post page is the one that can come back as a login wall.
 */
export function captionSources(rawUrl: string): CaptionSource[] {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return [];
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return [];

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host === "instagr.am") {
    // A share sheet's /share/reel/CODE sits in front of the same "reel" segment as an
    // ordinary link, so scanning for the kind finds both — the same reasoning, and the
    // same shapes, as `parseSocialEmbed`.
    const kindAt = segments.findIndex((s) => s === "reel" || s === "reels" || s === "p" || s === "tv");
    const kind = segments[kindAt] === "reels" ? "reel" : segments[kindAt];
    const code = kindAt >= 0 ? segments[kindAt + 1] : undefined;
    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return [];

    const sources: CaptionSource[] = [
      { url: `https://www.instagram.com/${kind}/${code}/embed/captioned/`, kind: "html", code },
    ];
    // `/p/` is the address Instagram's embed widget was built around, and a reel is also
    // a post. The reel-shaped embed address answered one of these with a body the same
    // size as the post page's own — the application shell, not an embed — so the older
    // address is worth asking as itself rather than assuming the two are one route.
    if (kind !== "p") {
      sources.push({ url: `https://www.instagram.com/p/${code}/embed/captioned/`, kind: "html", code });
    }
    sources.push({ url: `https://www.instagram.com/${kind}/${code}/`, kind: "html", code });
    return sources;
  }

  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    // TikTok is the one of the three with a real, open oEmbed endpoint — no token, no
    // pretending to be a browser — and its `title` is the caption verbatim.
    return [
      { url: `https://www.tiktok.com/oembed?url=${encodeURIComponent(withoutShareParams(url))}`, kind: "json" },
      { url: withoutShareParams(url), kind: "html" },
    ];
  }

  const facebookHost = host.replace(/^(m|web)\.facebook\.com$/, "facebook.com");
  if (facebookHost === "facebook.com" || facebookHost === "fb.watch") {
    const clean = withoutShareParams(url);
    const plugin = new URL("https://www.facebook.com/plugins/post.php");
    plugin.searchParams.set("href", clean);
    plugin.searchParams.set("show_text", "true");
    return [
      { url: clean, kind: "html" },
      { url: plugin.toString(), kind: "html" },
    ];
  }

  return [];
}

/** Whether a pasted link is one of the above, and so wants the caption route. */
export function isReelUrl(rawUrl: string): boolean {
  return captionSources(rawUrl).length > 0;
}

/**
 * Instagram's `og:description` wraps the caption in a sentence of its own — `2,481
 * likes, 57 comments - kitchen on June 4, 2025: "Pasta al limone …"` — so the wrapper
 * comes off before the caption is read. The quotes are the reliable part of that shape;
 * the counts and the date are not, and vary by language and by post.
 */
export function unwrapSocialDescription(description: string): string {
  const quoted = /:\s*["“”]([\s\S]*)["“”]\s*\.?\s*$/.exec(description.trim());
  return (quoted ? quoted[1] : description).trim();
}

/**
 * A caption out of whatever HTML came back, whichever of the three sent it.
 *
 * Instagram's embed page holds the real thing in a `.Caption` element, with the
 * account's name as a link at the front and the comment count in a block at the end;
 * both are stripped off, leaving the caption as it was typed. Everything else — a
 * signed-out post page, a Facebook post, a TikTok page — is read from `og:description`,
 * which is the same caption cut short but is a great deal better than nothing.
 *
 * `<br>` becomes a newline before any of this, because a caption's line breaks are the
 * whole of its structure: `cheerio`'s `.text()` drops them, and a caption arriving as
 * one long line is one `caption-recipe.ts` cannot read at all.
 */
export function captionFromHtml(html: string): ReelCaption | null {
  const $ = cheerio.load(html.replace(/<br\s*\/?>/gi, "\n"));

  const captionNode = $(".Caption").first();
  let caption = "";
  if (captionNode.length > 0) {
    const copy = captionNode.clone();
    copy.find(".CaptionUsername, .CaptionComments").remove();
    caption = copy.text();
  }

  const description =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    "";
  if (!caption.trim()) caption = unwrapSocialDescription(description);

  const imageUrl =
    $("img.EmbeddedMediaImage").first().attr("src") ??
    $('meta[property="og:image"]').attr("content") ??
    null;

  const pageTitle = (
    $('meta[property="og:title"]').attr("content") ??
    $("title").first().text() ??
    ""
  ).trim();

  if (!caption.trim()) {
    // Neither the embed markup nor a description of any kind: the page is the application
    // shell rather than the post. The post may still be in it, as the JSON its own client
    // would have read, so that is the last place to look before giving up on this source.
    const embedded = captionFromEmbeddedJson(html);
    if (!embedded) return null;
    return {
      caption: embedded.caption,
      imageUrl: imageUrl ?? embedded.imageUrl,
      pageTitle: pageTitle || embedded.pageTitle,
    };
  }
  return { caption: caption.trim(), imageUrl, pageTitle };
}

/**
 * Where a caption hides once the markup has moved, which by now is the usual case.
 *
 * `/embed/captioned/` used to answer a signed-out request with the caption in a `.Caption`
 * element and an `og:description` beside it. It now answers — to a browser's string and to
 * an honest crawler alike — with six hundred kilobytes of application shell carrying
 * neither: `reel_caption_source` logged exactly that twice, 200 OK, no login wall,
 * `hasCaptionElement` and `hasOgDescription` both false, for both addresses and within
 * thirty-five bytes of each other.
 *
 * What that shell still carries, because the page it boots would otherwise have to ask for
 * the post a second time, is the post itself as JSON in a `<script>` tag. So this is the
 * third place to look and deliberately the last: the two above are Instagram stating what
 * the post says, and this is reading over its shoulder. It is also the one most likely to
 * survive the next redesign, because those names are an API's field names rather than a
 * page's class names.
 *
 * Three shapes, because three generations of that API are still in circulation:
 * `edge_media_to_caption` (the GraphQL web shape), `caption.text` (what the newer
 * `xdt_api__v1__media__*` payloads use), and a bare `caption_text`. **The object is lifted
 * out by matching braces and handed to `JSON.parse`, never picked apart by pattern** — a
 * caption is free text and contains quotes, braces and escaped newlines, and a regex that
 * reads one is a regex that truncates the next.
 */
export function captionFromEmbeddedJson(body: string): ReelCaption | null {
  const direct = scanForCaption(body);
  if (direct) return direct;

  // Some of these payloads are inlined as a JSON *string* inside another JSON document, so
  // the whole object arrives escaped once over and none of the keys match as written.
  return body.includes('\\"') ? scanForCaption(unescapeOnce(body)) : null;
}

/** Keys whose value is an object holding the post's caption, likeliest shape first. */
const CAPTION_OBJECT_KEYS = ['"edge_media_to_caption"', '"caption"'];

function scanForCaption(text: string): ReelCaption | null {
  let caption: string | null = null;

  for (const key of CAPTION_OBJECT_KEYS) {
    for (let at = text.indexOf(key); at >= 0 && !caption; at = text.indexOf(key, at + key.length)) {
      const brace = text.indexOf("{", at + key.length);
      // `"caption": null` and `"caption": "…"` are the same key not holding an object;
      // anything but a colon between the two means this was some other key's tail.
      if (brace < 0 || !/^\s*:\s*$/.test(text.slice(at + key.length, brace))) continue;
      const node = jsonObjectAt(text, brace);
      if (node) caption = captionOf(node);
    }
    if (caption) break;
  }

  caption ??= firstJsonString(text, /"caption_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!caption?.trim()) return null;

  return {
    caption: caption.trim(),
    imageUrl: imageFrom(text),
    // Not a title so much as who posted it, which is what `og:title` would have said too
    // and is better than nothing for a caption that never names the dish.
    pageTitle: firstJsonString(text, /"username"\s*:\s*"((?:[^"\\]|\\.)*)"/) ?? "",
  };
}

/**
 * The poster frame out of the same payload, under whichever name this generation of it
 * gives the picture. The flat names are one string each; `image_versions2` is a list of
 * the same frame at every size, largest first, so the first candidate is the one to take.
 *
 * Null is a perfectly ordinary answer. A reel's poster frame is decoration for a recipe
 * whose text is the point, and `captionFromHtml` has the page's own `og:image` to fall
 * back on either way.
 */
function imageFrom(text: string): string | null {
  const flat = firstJsonString(
    text,
    /"(?:display_url|display_src|thumbnail_src|thumbnail_url)"\s*:\s*"((?:[^"\\]|\\.)*)"/,
  );
  if (flat) return flat;

  const at = text.indexOf('"image_versions2"');
  if (at < 0) return null;
  const brace = text.indexOf("{", at);
  const node = brace >= 0 ? jsonObjectAt(text, brace) : null;
  const first: unknown = Array.isArray(node?.candidates) ? node.candidates[0] : null;
  const url = (first as { url?: unknown } | null)?.url;
  return typeof url === "string" && url ? url : null;
}

/** The caption's text out of whichever of the shapes this object turned out to be. */
function captionOf(node: Record<string, unknown>): string | null {
  if (typeof node.text === "string" && node.text.trim()) return node.text;

  if (Array.isArray(node.edges)) {
    for (const edge of node.edges) {
      const inner: unknown = (edge as { node?: unknown } | null)?.node;
      const text = (inner as { text?: unknown } | null)?.text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }
  return null;
}

/**
 * The JSON object beginning at `start`, found by matching braces rather than by pattern —
 * the only way to know where an object ends when its values hold braces of their own.
 * Strings are tracked so a brace inside a caption cannot close it early.
 */
function jsonObjectAt(text: string, start: number): Record<string, unknown> | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}" && (depth -= 1) === 0) {
      try {
        const parsed: unknown = JSON.parse(text.slice(start, i + 1));
        return typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The first match's capture, read back as the JSON string it is rather than as raw text. */
function firstJsonString(text: string, pattern: RegExp): string | null {
  const raw = pattern.exec(text)?.[1];
  if (raw === undefined) return null;
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return null;
  }
}

/**
 * One level of JSON string escaping taken off, and nothing else.
 *
 * Only `\"` and `\\` are undone: a caption's own newline and its `\u00e6` are doubled in
 * that form too, and taking exactly one level off leaves them as the ordinary escapes
 * `JSON.parse` is about to read properly. Undoing them here instead would hand `JSON.parse`
 * a literal newline inside a string, which is not legal JSON.
 */
function unescapeOnce(text: string): string {
  return text.replace(/\\\\|\\"/g, (match) => (match === '\\"' ? '"' : "\\"));
}

/**
 * A caption out of an oEmbed document. TikTok's `title` is the post's own caption and
 * `thumbnail_url` its poster frame, which is exactly the pair this needs; the shape is
 * standard, so anything else answering oEmbed is read the same way.
 */
export function captionFromOEmbed(body: string): ReelCaption | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const doc = parsed as Record<string, unknown>;
  const caption = typeof doc.title === "string" ? doc.title.trim() : "";
  if (!caption) return null;

  return {
    caption,
    imageUrl: typeof doc.thumbnail_url === "string" ? doc.thumbnail_url : null,
    pageTitle: typeof doc.author_name === "string" ? doc.author_name : "",
  };
}
