export type ImportedRecipe = { title: string; ingredients: string; instructions: string };
export type ImportOutcome = { ok: true; recipe: ImportedRecipe } | { ok: false; error: string };

const GENERIC_ERROR =
  "Couldn't read a recipe from that page. Check the link, or fill the form in by hand.";

/** How much of a page is ever read — a bound on the request, not a claim about recipes. */
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
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
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
};

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

/** The `<title>` or `og:title` of a page, for when there is no JSON-LD title to use. */
function fallbackTitle(html: string): string {
  const og = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html);
  if (og?.[1]) return decodeEntities(og[1]).trim();

  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return title?.[1] ? decodeEntities(title[1]).trim() : "";
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
 * search engines (schema.org, as JSON-LD), rather than guessing at that site's own
 * markup: the structure is the same everywhere it appears, where the visible page never
 * is. A page with no such block, or one missing every field this needs, is refused
 * rather than guessed at from prose.
 */
export function parseRecipeFromHtml(html: string): ImportedRecipe | null {
  const node = findRecipeNode(jsonLdBlocks(html));

  const title = asLines(node?.name) || fallbackTitle(html);
  const ingredients = asLines(node?.recipeIngredient);
  const instructions = instructionLines(node?.recipeInstructions);

  if (!title || (!ingredients && !instructions)) return null;
  return { title, ingredients, instructions };
}

/**
 * Fetches a recipe page and parses it, refusing anything that is not a plain web page
 * on the open internet.
 *
 * The size and time limits exist because the page is chosen by whoever pastes the
 * link, not by this app: a slow or enormous response must not be able to hold a
 * request open or exhaust memory just because somebody pasted the wrong thing.
 */
export async function fetchRecipeFromUrl(rawUrl: string): Promise<ImportOutcome> {
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
  if (!response.ok || !response.body) return { ok: false, error: GENERIC_ERROR };

  // The redirect this app actually followed is what has to be checked, not the link
  // that was typed — a page can redirect an outside address to an internal one.
  if (isBlockedHost(new URL(response.url).hostname)) return { ok: false, error: GENERIC_ERROR };

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) return { ok: false, error: GENERIC_ERROR };

  let html: string;
  try {
    html = await readLimited(response.body, MAX_RESPONSE_BYTES);
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  const recipe = parseRecipeFromHtml(html);
  return recipe ? { ok: true, recipe } : { ok: false, error: GENERIC_ERROR };
}

async function readLimited(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
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

  return Buffer.concat(chunks).toString("utf-8");
}
