import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { fetchRecipeFromUrl, importPastedCaption } from "@/lib/recipe-import";
import { pngBytes } from "../helpers/images";
import { createHome } from "../helpers/factories";

/*
 * Extracting a page's text is pure and covered in tests/unit/recipe-extract.test.ts;
 * reading that text is a model call and is stubbed here as it is there, since a test that
 * let it run would be a test of somebody else's uptime. What is left is the half that
 * cannot be faked: fetching the recipe's own picture, downscaling it and writing it through
 * `storePhoto`, which is a real write and so wants a real database.
 *
 * The stubbed reader returns the same recipe every time. Nothing here is about what it
 * says — every assertion below is about a photograph, and where it ended up filed.
 */

/** What the form is handed. The importer signs its reading, so a save that leaves the
 *  text alone need not read it again; what the token says is `reading-token.test.ts`'s. */
const IMPORTED = {
  title: "Pandekager",
  ingredients: "200 g mel",
  instructions: "Steg dem.",
  totalTimeMinutes: null,
  note: null,
  reading: expect.any(String),
};

const READ = { ...IMPORTED, reading: undefined, steps: [{ uses: [0], minutes: null }] };

const { normalizeRecipe } = vi.hoisted(() => ({ normalizeRecipe: vi.fn() }));

vi.mock("@/lib/recipe-normalize", () => ({ normalizeRecipe }));

beforeEach(() => {
  normalizeRecipe.mockReset();
  normalizeRecipe.mockResolvedValue({ ok: true, recipe: READ });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function htmlResponse(html: string, url: string) {
  return {
    ok: true,
    url,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(html));
        controller.close();
      },
    }),
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
  } as Response;
}

function imageResponse(bytes: Uint8Array, url: string, contentType = "image/png") {
  return {
    ok: true,
    url,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    headers: new Headers({ "content-type": contentType }),
  } as Response;
}

function pageWithLdJson(recipe: unknown) {
  return `<!doctype html><html><head>
    <script type="application/ld+json">${JSON.stringify(recipe)}</script>
  </head></html>`;
}

/** A recipe page naming `image` as its picture, which is what these tests are all about. */
function pageWithImage(image: string) {
  return pageWithLdJson({
    "@type": "Recipe",
    name: "Pandekager",
    recipeIngredient: ["200 g mel"],
    recipeInstructions: "Steg dem.",
    image,
  });
}

/** Answers each fetch by matching the URL asked for against a map of canned responses. */
function stubFetch(responses: Record<string, Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const response = responses[url];
    if (!response) throw new Error(`unexpected fetch: ${url}`);
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchRecipeFromUrl — the recipe's own picture", () => {
  it("fetches, downscales and stores it under the caller's home", async () => {
    const home = await createHome();
    stubFetch({
      "https://example.com/recipe": htmlResponse(
        pageWithImage("https://example.com/pancakes.png"),
        "https://example.com/recipe",
      ),
      "https://example.com/pancakes.png": imageResponse(
        pngBytes(2000, 1500, { noisy: true }),
        "https://example.com/pancakes.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.photoId).not.toBeNull();

    const stored = await prisma.photo.findUniqueOrThrow({
      where: { id: result.recipe.photoId! },
    });
    expect(stored.homeId).toBe(home.id);
    // downscaleForStorage always writes out JPEG, the same as the browser's own
    // downscale.ts does, whatever format the source picture arrived in.
    expect(stored.contentType).toBe("image/jpeg");
    expect(stored.width).toBeLessThanOrEqual(1600);
    expect(stored.height).toBeLessThanOrEqual(1600);
    expect(stored.thumbWidth).toBeLessThanOrEqual(600);
    expect(stored.thumbHeight).toBeLessThanOrEqual(600);
  });

  it("resolves a relative image URL against the page it was found on, not the link pasted", async () => {
    const home = await createHome();
    stubFetch({
      // The page redirected, as real sites do — the relative image path has to resolve
      // against where the app actually landed, not the address that was typed.
      "https://example.com/recipe": htmlResponse(
        pageWithImage("/images/pancakes.png"),
        "https://example.com/en/recipe",
      ),
      "https://example.com/images/pancakes.png": imageResponse(
        pngBytes(800, 600),
        "https://example.com/images/pancakes.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.photoId).not.toBeNull();
  });

  it("leaves the recipe intact when the image is not a real picture", async () => {
    const home = await createHome();
    stubFetch({
      "https://example.com/recipe": htmlResponse(
        pageWithImage("https://example.com/not-a-picture.png"),
        "https://example.com/recipe",
      ),
      "https://example.com/not-a-picture.png": imageResponse(
        new TextEncoder().encode("not actually a picture"),
        "https://example.com/not-a-picture.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    // A picture that cannot be read is decoration this recipe goes without, never a
    // reason to refuse a recipe that was otherwise perfectly readable.
    expect(result).toEqual({ ok: true, recipe: { ...IMPORTED, photoId: null, videoUrl: null } });
    expect(await prisma.photo.count()).toBe(0);
  });

  it("leaves the recipe intact when the image cannot be fetched at all", async () => {
    const home = await createHome();
    const html = pageWithImage("https://example.com/gone.png");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://example.com/recipe") return htmlResponse(html, url);
      throw new Error("network error");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result).toEqual({ ok: true, recipe: { ...IMPORTED, photoId: null, videoUrl: null } });
    expect(await prisma.photo.count()).toBe(0);
  });

  it("never fetches an image pointing back at the server's own network", async () => {
    const home = await createHome();
    const fetchMock = stubFetch({
      "https://example.com/recipe": htmlResponse(
        pageWithImage("http://169.254.169.254/latest/meta-data/pancakes.png"),
        "https://example.com/recipe",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result).toEqual({ ok: true, recipe: { ...IMPORTED, photoId: null, videoUrl: null } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.photo.count()).toBe(0);
  });

  it("files the picture under the importing home, not any other", async () => {
    const home = await createHome();
    const otherHome = await createHome();
    stubFetch({
      "https://example.com/recipe": htmlResponse(
        pageWithImage("https://example.com/pancakes.png"),
        "https://example.com/recipe",
      ),
      "https://example.com/pancakes.png": imageResponse(
        pngBytes(800, 600),
        "https://example.com/pancakes.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await prisma.photo.findUniqueOrThrow({
      where: { id: result.recipe.photoId! },
    });
    expect(stored.homeId).toBe(home.id);
    expect(stored.homeId).not.toBe(otherHome.id);
  });

  /*
   * The picture is fetched only once the reading has come back good, which is worth having
   * a real database to assert: an import that refuses still leaves nothing behind for the
   * upload sweep to find later.
   */
  it("stores nothing at all for a page the reader would not read", async () => {
    const home = await createHome();
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "not-a-recipe" });
    const fetchMock = stubFetch({
      "https://example.com/recipe": htmlResponse(
        pageWithImage("https://example.com/pancakes.png"),
        "https://example.com/recipe",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.photo.count()).toBe(0);
  });

  it("stores nothing when the reader itself cannot be reached", async () => {
    const home = await createHome();
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "unavailable" });
    stubFetch({
      "https://example.com/recipe": htmlResponse(
        pageWithImage("https://example.com/pancakes.png"),
        "https://example.com/recipe",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("Couldn't read that recipe just now"),
      notARecipe: true,
    });
    expect(await prisma.photo.count()).toBe(0);
  });

  /*
   * Not `notARecipe`: that is what offers the paste box, and the paste box goes to this
   * same reader, which would turn the pasted text away for the same reason.
   */
  it("says a home past its month's allowance is, and offers no paste box", async () => {
    const home = await createHome();
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "over-limit" });
    stubFetch({
      "https://example.com/recipe": htmlResponse(
        pageWithImage("https://example.com/pancakes.png"),
        "https://example.com/recipe",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id, home.language);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("this month's allowance") });
    expect(await prisma.photo.count()).toBe(0);
  });
});

/*
 * A reel's poster frame is the nearest thing it has to a photograph of the finished dish,
 * and it is stored exactly as any upload is — which is a real write, so it is here rather
 * than in the unit suite. Which addresses are asked, and in what order, is pinned in
 * tests/unit/recipe-import.test.ts.
 */
describe("a reel's poster frame", () => {
  const REEL = "https://www.instagram.com/reel/ABC123/";
  const EMBED = "https://www.instagram.com/reel/ABC123/embed/captioned/";
  const POSTER = "https://scontent.example/poster.png";

  const embedPage = `<html><body>
    <img class="EmbeddedMediaImage" src="${POSTER}" />
    <div class="Caption">
      <a class="CaptionUsername">somekitchen</a>
      Boller<br>Ingredienser<br>500 g mel<br>25 g gær<br>Fremgangsmåde<br>Ælt det sammen.
    </div>
  </body></html>`;

  it("stores it under the importing home, with the reel kept as the video", async () => {
    const home = await createHome();
    stubFetch({
      [EMBED]: htmlResponse(embedPage, EMBED),
      [POSTER]: imageResponse(pngBytes(720, 1280), POSTER),
    });

    const result = await fetchRecipeFromUrl(REEL, home.id, home.language);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.videoUrl).toBe(REEL);

    const stored = await prisma.photo.findUniqueOrThrow({
      where: { id: result.recipe.photoId! },
    });
    expect(stored.homeId).toBe(home.id);
  });

  // The poster frame's address is relative to whichever source answered, not to the reel
  // link the cook pasted — which stays `sourceUrl` so the recipe's video points at the post.
  it("resolves a relative poster frame against the source that answered", async () => {
    const home = await createHome();
    const relative = `<html><body>
      <img class="EmbeddedMediaImage" src="/poster.png" />
      <div class="Caption">Boller<br>500 g mel</div>
    </body></html>`;
    stubFetch({
      [EMBED]: htmlResponse(relative, EMBED),
      "https://www.instagram.com/poster.png": imageResponse(
        pngBytes(720, 1280),
        "https://www.instagram.com/poster.png",
      ),
    });

    const result = await fetchRecipeFromUrl(REEL, home.id, home.language);

    expect(result.ok && result.recipe.photoId).toEqual(expect.any(String));
  });

  it("is still worth a try for a caption the cook pasted in by hand", async () => {
    const home = await createHome();
    stubFetch({
      [EMBED]: htmlResponse(embedPage, EMBED),
      [POSTER]: imageResponse(pngBytes(720, 1280), POSTER),
    });

    const result = await importPastedCaption(
      "Boller\nIngredienser\n500 g mel\n25 g gær\nFremgangsmåde\nÆlt det sammen.",
      REEL,
      home.id,
      home.language,
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.recipe.photoId).toEqual(expect.any(String));
    expect(await prisma.photo.count()).toBe(1);
  });

  it("never refuses a pasted recipe for want of a picture it could not fetch", async () => {
    const home = await createHome();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Instagram said no")));

    const result = await importPastedCaption(
      "Boller\nIngredienser\n500 g mel\n25 g gær\nFremgangsmåde\nÆlt det sammen.",
      REEL,
      home.id,
      home.language,
    );

    expect(result).toEqual({ ok: true, recipe: { ...IMPORTED, photoId: null, videoUrl: REEL } });
    expect(await prisma.photo.count()).toBe(0);
  });
});
