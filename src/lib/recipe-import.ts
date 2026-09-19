import * as cheerio from "cheerio";
import sharp from "sharp";
import { MAX_EDGE, THUMB_EDGE } from "./downscale";
import { storePhoto } from "./photos";

/** What a page's own markup says its recipe is, before an image has been fetched. */
type ParsedRecipe = {
  title: string;
  ingredients: string;
  instructions: string;
  imageUrl: string | null;
  totalTimeMinutes: number | null;
};

export type ImportedRecipe = {
  title: string;
  ingredients: string;
  instructions: string;
  photoId: string | null;
  totalTimeMinutes: number | null;
};
/**
 * `notARecipe` marks a failure where the page was reached fine and simply had nothing
 * to cook from — a reel, a shop page, a site whose markup this cannot read — so that
 * `RecipeImportField` can offer falling back to the plain create form for exactly this
 * failure and not for a mistyped address or a page that would not load at all, which
 * are worth retrying as typed. It is a flag rather than matching the error string on
 * the client: this module pulls in `sharp` for the image work below, which cannot be
 * bundled into the client component that shows the error, so nothing runtime from here
 * may be imported there — only the types already were.
 */
export type ImportOutcome =
  | { ok: true; recipe: ImportedRecipe }
  | { ok: false; error: string; notARecipe?: boolean };

const GENERIC_ERROR =
  "Couldn't read a recipe from that page. Check the link, or fill the form in by hand.";

/** How much of a page is ever read — a bound on the request, not a claim about recipes. */
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
/** A recipe's own hero photo is never anywhere near this; it exists to bound the request. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

/**
 * Node's `fetch` sends no `User-Agent` at all unless told to, which plenty of ordinary
 * sites treat as reason enough to refuse the request or hand back a stripped page with
 * none of the markup this is looking for — not because the request is doing anything
 * untoward, but because "no browser looks like this" is a cheap first filter against
 * bots that never got past this app fetching a page a person explicitly linked to. A
 * browser's own string gets past that filter; it changes nothing about what is done
 * with the page once it arrives.
 */
const REQUEST_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
};
// Deliberately no Accept-Language: the link already says which page a cook wants, and
// a site that negotiates by language rather than URL — some do, across country and
// language domains — took an English preference here as a reason to swap in its
// English site instead, which does not have a Danish recipe pasted from the Danish
// one. Sending none asks for whatever the address itself already means.

/**
 * Blocks the addresses a browser would never be steered toward by a recipe link: the
 * machine itself, its own network, and the link-local range cloud providers use for
 * instance metadata. This is a household app fetching a page somebody chose to paste,
 * not a browser with its own cross-origin rules, so that check has to be written here
 * instead — a `javascript:` or `file:` link is refused by the protocol check below, and
 * these are refused by address.
 */
function isBlockedHost(hostname: string): boolean {
  // IPv6 literals arrive bracketed in a URL's hostname ("[::1]"); the ranges below are
  // compared against the address itself.
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  // A URL's hostname never otherwise contains a colon, so this is the one case left:
  // an IPv6 literal. ::1 (loopback), fe80::/10 (link-local) and fc00::/7 (unique local)
  // are the ranges with the same reach as the IPv4 ones above. Checked only once it is
  // known to be an address rather than a name — "fc" and "fd" are also how plenty of
  // ordinary domains start, and matching those was refusing real sites outright.
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
  }

  return false;
}

/** A link this feature will actually fetch, or null for anything it should refuse. */
function safeImportUrl(rawUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

/** Every `<script type="application/ld+json">…</script>` block on the page, parsed. */
function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Malformed JSON-LD is common enough (a stray trailing comma, HTML-escaped
      // quotes) that skipping the block is more useful than refusing the whole page.
    }
  }
  return blocks;
}

/** `@type` is either a bare string or an array of them, per the schema.org spec. */
function hasType(node: unknown, type: string): node is Record<string, unknown> {
  if (typeof node !== "object" || node === null) return false;
  const value = (node as Record<string, unknown>)["@type"];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/** Every node in a JSON-LD document, including the ones nested under `@graph`. */
function flatten(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === "object" && node !== null) {
    const graph = (node as Record<string, unknown>)["@graph"];
    return graph ? [node, ...flatten(graph)] : [node];
  }
  return [];
}

function findRecipeNode(blocks: unknown[]): Record<string, unknown> | null {
  for (const node of blocks.flatMap(flatten)) {
    if (hasType(node, "Recipe")) return node;
  }
  return null;
}

/** A field that arrives as one string or a list of them, joined the way this app stores it. */
function asLines(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(asLines).filter(Boolean).join("\n");
  return "";
}

/**
 * `recipeInstructions` is the messiest field in the spec: a single block of text, a
 * flat list of strings, or a list of `HowToStep`/`HowToSection` objects nested inside
 * one another. This walks whatever shape arrives and pulls out only the text.
 */
function instructionLines(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(instructionLines).filter(Boolean).join("\n");
  if (typeof value === "object" && value !== null) {
    const node = value as Record<string, unknown>;
    if (hasType(node, "HowToSection") && node.itemListElement) {
      return instructionLines(node.itemListElement);
    }
    if (typeof node.text === "string") return node.text.trim();
    if (typeof node.name === "string") return node.name.trim();
  }
  return "";
}

/**
 * `Recipe` markup as schema.org actually reaches the wild in a second, older shape:
 * Microdata (`itemscope`/`itemtype`/`itemprop` attributes on the page's own elements)
 * rather than a separate JSON-LD block. Both say the same thing; a site publishes
 * whichever its CMS happened to generate, sometimes both, rarely neither. Microdata is
 * scattered across the DOM rather than sitting in one parseable block, which is what a
 * proper parser is for here rather than another regular expression.
 */
function microdataRecipeRoot($: cheerio.CheerioAPI) {
  return $("[itemscope]")
    .filter((_, el) => /schema\.org\/recipe\s*$/i.test($(el).attr("itemtype")?.trim() ?? ""))
    .first();
}

function microdataText($: cheerio.CheerioAPI, root: ReturnType<typeof microdataRecipeRoot>, prop: string) {
  return root
    .find(`[itemprop="${prop}"]`)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n");
}

/**
 * A duration in Microdata is conventionally a `<time>` element's `datetime` attribute
 * (`<time itemprop="totalTime" datetime="PT30M">30 mins</time>`), because the visible
 * text is for a reader and the attribute is for exactly this kind of scraping — schema.org
 * only ever promises the machine-readable value lives *somewhere* on the tagged element, so
 * `content` and the element's own text are read too, for the templates that skip `<time>`.
 */
function microdataDurationMinutes(
  $: cheerio.CheerioAPI,
  root: ReturnType<typeof microdataRecipeRoot>,
  prop: string,
): number | null {
  const el = root.find(`[itemprop="${prop}"]`).first();
  if (el.length === 0) return null;
  return isoDurationMinutes(el.attr("datetime") ?? el.attr("content") ?? el.text());
}

/**
 * `recipeInstructions` in Microdata arrives in whichever of two shapes a site chose:
 * the property repeated once per step, or once on a container whose own steps (or
 * paragraphs, where the steps are not marked up at all) sit inside it.
 */
function microdataInstructions($: cheerio.CheerioAPI, root: ReturnType<typeof microdataRecipeRoot>) {
  const nodes = root.find('[itemprop="recipeInstructions"]');
  if (nodes.length > 1) {
    return nodes
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .join("\n");
  }

  const container = nodes.first();
  const steps = container.find('[itemprop="text"], li, p');
  const text = steps.length > 0 ? steps : container;
  return text
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n");
}

/**
 * schema.org times (`prepTime`, `cookTime`, `totalTime`) are ISO 8601 durations —
 * `PT1H30M`, not "1 hour 30 minutes" — because the spec wants a machine-readable value
 * and a recipe site's template obliges. Only the units a recipe could plausibly use are
 * read; a duration naming years or months is not a cooking time this app is prepared to
 * believe.
 */
function isoDurationMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;

  const totalMinutes =
    Number(days ?? 0) * 24 * 60 + Number(hours ?? 0) * 60 + Number(minutes ?? 0) + Number(seconds ?? 0) / 60;
  return Math.round(totalMinutes);
}

/**
 * A recipe's total time, the way the filter on `/recipes` wants it: one number, start
 * to finish. `totalTime` says that directly where a site publishes it; failing that,
 * `prepTime` and `cookTime` are added together, because a site publishing only those
 * two is still telling you how long the recipe takes — just in two pieces rather than
 * one. Neither present is not the same as zero, so it stays null rather than becoming a
 * recipe that claims to take no time at all.
 */
function combinedTimeMinutes(
  total: number | null,
  prep: number | null,
  cook: number | null,
): number | null {
  if (total !== null) return total;
  if (prep === null && cook === null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

/** The `<title>` or `og:title` of a page, for when there is no JSON-LD title to use. */
function fallbackTitle(html: string): string {
  const og = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html);
  if (og?.[1]) return decodeEntities(og[1]).trim();

  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return title?.[1] ? decodeEntities(title[1]).trim() : "";
}

/**
 * `image` in JSON-LD is a URL, a list of them, an `ImageObject`, or a list of those —
 * schema.org allows all four for the same property, and a site picks whichever its
 * template happened to produce.
 */
function jsonLdImageUrl(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = jsonLdImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof value === "object" && value !== null) {
    const url = (value as Record<string, unknown>).url;
    if (typeof url === "string") return url;
  }
  return null;
}

/**
 * `image` in Microdata is usually the `src` of an `<img>` or the `href` of a `<link>`
 * carrying the property directly, occasionally a `<meta content>`, and rarely a nested
 * `ImageObject` with its own `url` inside.
 */
function microdataImageUrl($: cheerio.CheerioAPI, root: ReturnType<typeof microdataRecipeRoot>) {
  const el = root.find('[itemprop="image"]').first();
  if (el.length === 0) return null;

  return (
    el.attr("src") ??
    el.attr("href") ??
    el.attr("content") ??
    el.find('[itemprop="url"]').first().attr("content") ??
    null
  );
}

/** `og:image`, for a page with neither JSON-LD nor Microdata to say what its picture is. */
function ogImage(html: string): string | null {
  const match = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i.exec(html);
  return match?.[1] ? decodeEntities(match[1]).trim() : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

/**
 * Turns a recipe page's HTML into a title, ingredients and instructions — or null when
 * nothing usable was found.
 *
 * Reads the `Recipe` structured data almost every recipe site already publishes for
 * search engines — schema.org, as JSON-LD or as Microdata, whichever that site's own
 * software happened to generate — rather than guessing at the page's visible markup,
 * which differs everywhere the structured data does not. JSON-LD is read first, since
 * it is one self-contained block rather than attributes to gather across the page, and
 * Microdata fills in whatever field it left blank: a page mixing the two, or complete
 * in neither alone, is not a page this should give up on. One missing every field this
 * needs, in both, is refused rather than guessed at from prose.
 */
export function parseRecipeFromHtml(html: string): ParsedRecipe | null {
  const jsonLd = findRecipeNode(jsonLdBlocks(html));
  const $ = cheerio.load(html);
  const microdata = microdataRecipeRoot($);
  const hasMicrodata = microdata.length > 0;

  const title =
    asLines(jsonLd?.name) ||
    (hasMicrodata ? microdataText($, microdata, "name") : "") ||
    fallbackTitle(html);
  const ingredients =
    asLines(jsonLd?.recipeIngredient) ||
    (hasMicrodata ? microdataText($, microdata, "recipeIngredient") : "");
  const instructions =
    instructionLines(jsonLd?.recipeInstructions) ||
    (hasMicrodata ? microdataInstructions($, microdata) : "");
  const imageUrl =
    jsonLdImageUrl(jsonLd?.image) || (hasMicrodata ? microdataImageUrl($, microdata) : null) || ogImage(html);
  const totalTimeMinutes =
    combinedTimeMinutes(
      isoDurationMinutes(jsonLd?.totalTime),
      isoDurationMinutes(jsonLd?.prepTime),
      isoDurationMinutes(jsonLd?.cookTime),
    ) ??
    (hasMicrodata
      ? combinedTimeMinutes(
          microdataDurationMinutes($, microdata, "totalTime"),
          microdataDurationMinutes($, microdata, "prepTime"),
          microdataDurationMinutes($, microdata, "cookTime"),
        )
      : null);

  if (!title || (!ingredients && !instructions)) return null;
  return { title, ingredients, instructions, imageUrl, totalTimeMinutes };
}

/**
 * Fetches a recipe page and parses it, refusing anything that is not a plain web page
 * on the open internet. Its picture, if it has one, is fetched and stored under the
 * caller's home the same way any other upload is — but only once the recipe itself is
 * good, and never in a way that can fail the import: a picture that cannot be fetched
 * or does not survive `storePhoto`'s own checks is left out rather than refusing a
 * recipe that was otherwise perfectly readable.
 *
 * The size and time limits exist because the page is chosen by whoever pastes the
 * link, not by this app: a slow or enormous response must not be able to hold a
 * request open or exhaust memory just because somebody pasted the wrong thing.
 */
export async function fetchRecipeFromUrl(rawUrl: string, homeId: string): Promise<ImportOutcome> {
  const url = safeImportUrl(rawUrl);
  if (!url) return { ok: false, error: "That doesn't look like a web address." };

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
  } catch {
    return { ok: false, error: "Couldn't reach that page. Check the link and try again." };
  }
  if (!response.ok || !response.body) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  // The redirect this app actually followed is what has to be checked, not the link
  // that was typed — a page can redirect an outside address to an internal one.
  if (isBlockedHost(new URL(response.url).hostname)) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  let bytes: Uint8Array;
  try {
    bytes = await readLimited(response.body, MAX_RESPONSE_BYTES);
  } catch {
    return { ok: false, error: GENERIC_ERROR, notARecipe: true };
  }

  const parsed = parseRecipeFromHtml(decodeHtml(bytes, contentType));
  if (!parsed) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  const photoId = await importRecipeImage(parsed.imageUrl, response.url, homeId);
  return {
    ok: true,
    recipe: {
      title: parsed.title,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions,
      photoId,
      totalTimeMinutes: parsed.totalTimeMinutes,
    },
  };
}

/**
 * Fetches a recipe's own picture and files it under the home doing the import, or
 * gives up quietly. A page's `image` is frequently relative to the page itself, so it
 * is resolved against the address this app actually landed on rather than the link
 * that was pasted — the same reasoning `isBlockedHost` already applies to redirects
 * applies here: whatever the page points at is checked as its own address, not assumed
 * safe for having been mentioned by a page that itself passed the check.
 */
async function importRecipeImage(
  imageUrl: string | null,
  pageUrl: string,
  homeId: string,
): Promise<string | null> {
  if (!imageUrl) return null;

  let resolved: URL;
  try {
    resolved = new URL(imageUrl, pageUrl);
  } catch {
    return null;
  }
  const url = safeImportUrl(resolved.toString());
  if (!url) return null;

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
  } catch {
    return null;
  }
  if (!response.ok || !response.body) return null;
  if (isBlockedHost(new URL(response.url).hostname)) return null;

  let bytes: Uint8Array;
  try {
    bytes = await readLimited(response.body, MAX_IMAGE_BYTES);
  } catch {
    return null;
  }

  try {
    const { full, thumb } = await downscaleForStorage(bytes);
    const stored = await storePhoto(homeId, full, thumb);
    return stored.ok ? stored.id : null;
  } catch {
    // A file that claims to be a picture but is not one sharp can decode, say — this
    // is decoration for a recipe that is otherwise complete, not a reason to refuse it.
    return null;
  }
}

/**
 * The server-side equivalent of `lib/downscale.ts`, which needs a browser's canvas and
 * so cannot run here. Same edges, same rough quality, for the same reason: nothing in
 * this app shows a picture larger than `MAX_EDGE`, and a page's own hero image is
 * ordinarily much larger than that.
 */
async function downscaleForStorage(bytes: Uint8Array) {
  const source = sharp(bytes, { failOn: "none" }).rotate();
  const [full, thumb] = await Promise.all([
    source
      .clone()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer(),
    source
      .clone()
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer(),
  ]);
  return { full, thumb };
}

async function readLimited(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Response too large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

/**
 * Decodes a page's bytes the way a browser would: by what the page itself says its
 * encoding is, never by assuming UTF-8. Most sites are UTF-8 and this changes nothing
 * for them, but the ones that are not are disproportionately the ones with characters
 * outside plain English in the first place — æ, ø and å among them — so assuming wrong
 * is exactly invisible on an English test page and wrong on every other kind.
 */
function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const declared =
    /charset=([^;]+)/i.exec(contentType)?.[1] ??
    // The HTML spec allows the charset to be declared in a <meta> tag instead of the
    // response header, always within the first kilobyte — no need to read further.
    /<meta[^>]+charset=["']?([a-z0-9_-]+)/i.exec(
      Buffer.from(bytes.subarray(0, 1024)).toString("latin1"),
    )?.[1];

  if (declared) {
    try {
      return new TextDecoder(declared.trim().toLowerCase()).decode(bytes);
    } catch {
      // An unrecognised or misdeclared label — fall through to the default.
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}
