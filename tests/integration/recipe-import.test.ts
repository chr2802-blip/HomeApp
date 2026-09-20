import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { fetchRecipeFromUrl, importPastedCaption } from "@/lib/recipe-import";
import { pngBytes } from "../helpers/images";
import { createHome } from "../helpers/factories";

/*
 * The parsing itself — reading JSON-LD and Microdata out of a page's HTML — is pure
 * and covered in tests/unit/recipe-import.test.ts, with no database in reach. Fetching
 * and storing the recipe's own picture is not: it ends in `storePhoto`, a real write,
 * so that half lives here instead, against a real (if fake-network) database.
 */

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches, downscales and stores it under the caller's home", async () => {
    const home = await createHome();
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "https://example.com/pancakes.png",
    });
    stubFetch({
      "https://example.com/recipe": htmlResponse(html, "https://example.com/recipe"),
      "https://example.com/pancakes.png": imageResponse(
        pngBytes(2000, 1500, { noisy: true }),
        "https://example.com/pancakes.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id);

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
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "/images/pancakes.png",
    });
    stubFetch({
      // The page redirected, as real sites do — the relative image path has to resolve
      // against where the app actually landed, not the address that was typed.
      "https://example.com/recipe": htmlResponse(html, "https://example.com/en/recipe"),
      "https://example.com/images/pancakes.png": imageResponse(
        pngBytes(800, 600),
        "https://example.com/images/pancakes.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.photoId).not.toBeNull();
  });

  it("leaves the recipe intact when the image is not a real picture", async () => {
    const home = await createHome();
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "https://example.com/not-a-picture.png",
    });
    stubFetch({
      "https://example.com/recipe": htmlResponse(html, "https://example.com/recipe"),
      "https://example.com/not-a-picture.png": imageResponse(
        new TextEncoder().encode("not actually a picture"),
        "https://example.com/not-a-picture.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id);

    // A picture that cannot be read is decoration this recipe goes without, never a
    // reason to refuse a recipe that was otherwise perfectly readable.
    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Pancakes",
        ingredients: "Flour",
        instructions: "Fry.",
        photoId: null,
        totalTimeMinutes: null,
        videoUrl: null,
      },
    });
    expect(await prisma.photo.count()).toBe(0);
  });

  it("leaves the recipe intact when the image cannot be fetched at all", async () => {
    const home = await createHome();
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "https://example.com/gone.png",
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://example.com/recipe") return htmlResponse(html, url);
      throw new Error("network error");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id);

    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Pancakes",
        ingredients: "Flour",
        instructions: "Fry.",
        photoId: null,
        totalTimeMinutes: null,
        videoUrl: null,
      },
    });
    expect(await prisma.photo.count()).toBe(0);
  });

  it("never fetches an image pointing back at the server's own network", async () => {
    const home = await createHome();
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "http://169.254.169.254/latest/meta-data/pancakes.png",
    });
    const fetchMock = stubFetch({
      "https://example.com/recipe": htmlResponse(html, "https://example.com/recipe"),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id);

    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Pancakes",
        ingredients: "Flour",
        instructions: "Fry.",
        photoId: null,
        totalTimeMinutes: null,
        videoUrl: null,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await prisma.photo.count()).toBe(0);
  });

  it("files the picture under the importing home, not any other", async () => {
    const home = await createHome();
    const otherHome = await createHome();
    const html = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["Flour"],
      recipeInstructions: "Fry.",
      image: "https://example.com/pancakes.png",
    });
    stubFetch({
      "https://example.com/recipe": htmlResponse(html, "https://example.com/recipe"),
      "https://example.com/pancakes.png": imageResponse(
        pngBytes(800, 600),
        "https://example.com/pancakes.png",
      ),
    });

    const result = await fetchRecipeFromUrl("https://example.com/recipe", home.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await prisma.photo.findUniqueOrThrow({
      where: { id: result.recipe.photoId! },
    });
    expect(stored.homeId).toBe(home.id);
    expect(stored.homeId).not.toBe(otherHome.id);
  });
});

/*
 * A reel's poster frame is the nearest thing it has to a photograph of the finished
 * dish, and it is stored exactly as any upload is — which is a real write, so it is
 * here rather than in the unit suite. Reading the caption itself is pure and lives in
 * tests/unit/caption-recipe.test.ts.
 */
describe("a reel's poster frame", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

    const result = await fetchRecipeFromUrl(REEL, home.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toBe("Boller");
    expect(result.recipe.videoUrl).toBe(REEL);

    const stored = await prisma.photo.findUniqueOrThrow({
      where: { id: result.recipe.photoId! },
    });
    expect(stored.homeId).toBe(home.id);
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
    );

    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Boller",
        ingredients: "500 g mel\n25 g gær",
        instructions: "Ælt det sammen.",
        photoId: null,
        totalTimeMinutes: null,
        videoUrl: REEL,
      },
    });
    expect(await prisma.photo.count()).toBe(0);
  });
});
