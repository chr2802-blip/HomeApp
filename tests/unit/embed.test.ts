import { describe, expect, it } from "vitest";
import { safeExternalHref, toEmbed } from "@/lib/embed";

describe("toEmbed — Instagram", () => {
  it("embeds a reel through Instagram's own reel embed endpoint", () => {
    expect(toEmbed("https://www.instagram.com/reel/Cx1y2Z3aBcD/")).toEqual({
      src: "https://www.instagram.com/reel/Cx1y2Z3aBcD/embed/",
      aspect: "vertical",
      fixed: { provider: "instagram", width: 380, height: 600 },
    });
  });

  it("keeps a post or a tv link on its own kind of embed, and folds the reels spelling into reel", () => {
    expect(toEmbed("https://instagram.com/p/AbC123/")?.src).toBe(
      "https://www.instagram.com/p/AbC123/embed/",
    );
    expect(toEmbed("https://instagram.com/tv/AbC123/")?.src).toBe(
      "https://www.instagram.com/tv/AbC123/embed/",
    );
    expect(toEmbed("https://instagram.com/reels/AbC123/")?.src).toBe(
      "https://www.instagram.com/reel/AbC123/embed/",
    );
  });

  it("handles a username in the path and strips tracking query params", () => {
    expect(toEmbed("https://www.instagram.com/somecook/reel/AbC123/?igsh=tracking")?.src).toBe(
      "https://www.instagram.com/reel/AbC123/embed/",
    );
  });

  it("accepts the instagr.am short domain", () => {
    expect(toEmbed("https://instagr.am/reel/AbC123/")?.src).toBe(
      "https://www.instagram.com/reel/AbC123/embed/",
    );
  });

  it("rejects a profile link with no shortcode", () => {
    expect(toEmbed("https://www.instagram.com/somecook/")).toBeNull();
  });
});

describe("toEmbed — YouTube", () => {
  it("embeds a watch URL", () => {
    expect(toEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      aspect: "wide",
    });
  });

  it("embeds a short as vertical", () => {
    expect(toEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      aspect: "vertical",
    });
  });

  it("embeds youtu.be links", () => {
    expect(toEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("rejects a YouTube URL with no video id", () => {
    expect(toEmbed("https://www.youtube.com/watch")).toBeNull();
    expect(toEmbed("https://www.youtube.com/")).toBeNull();
  });
});

describe("toEmbed — other hosts", () => {
  it("embeds TikTok videos", () => {
    expect(toEmbed("https://www.tiktok.com/@chef/video/7234567890123456789")).toEqual({
      src: "https://www.tiktok.com/embed/v2/7234567890123456789",
      aspect: "vertical",
    });
  });

  it("rejects a TikTok id that is not numeric", () => {
    expect(toEmbed("https://www.tiktok.com/@chef/video/not-a-number")).toBeNull();
  });

  it("embeds Vimeo videos", () => {
    expect(toEmbed("https://vimeo.com/123456789")).toEqual({
      src: "https://player.vimeo.com/video/123456789",
      aspect: "wide",
    });
  });

  it("routes Facebook videos through the plugin player", () => {
    const embed = toEmbed("https://www.facebook.com/watch/?v=123456789");
    expect(embed?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
    expect(embed?.src).toContain("show_text=false");
    expect(embed?.src).toContain("width=380");
    expect(embed?.fixed).toEqual({ provider: "facebook", width: 380, height: 680 });
  });

  it("keeps a video's own query parameters but strips tracking ones from the href it hands Facebook", () => {
    const embed = toEmbed("https://www.facebook.com/watch/?v=123456789&mibextid=abc123");
    const href = new URL(embed!.src).searchParams.get("href")!;
    expect(href).toBe("https://www.facebook.com/watch?v=123456789");
  });

  it("accepts a reel link and fb.watch, and normalizes the mobile and web subdomains", () => {
    for (const url of [
      "https://www.facebook.com/reel/123456789",
      "https://fb.watch/AbC123/",
      "https://m.facebook.com/reel/123456789",
      "https://web.facebook.com/reel/123456789",
    ]) {
      expect(toEmbed(url)?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
    }
  });
});

describe("toEmbed — refuses anything not allowlisted", () => {
  it("returns null for an unknown host", () => {
    expect(toEmbed("https://evil.example.com/video/1")).toBeNull();
  });

  it("returns null for dangerous schemes", () => {
    expect(toEmbed("javascript:alert(1)")).toBeNull();
    expect(toEmbed("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(toEmbed("file:///etc/passwd")).toBeNull();
  });

  it("returns null for empty and malformed input", () => {
    expect(toEmbed(null)).toBeNull();
    expect(toEmbed(undefined)).toBeNull();
    expect(toEmbed("")).toBeNull();
    expect(toEmbed("not a url")).toBeNull();
  });

  it("is not fooled by a lookalike host", () => {
    expect(toEmbed("https://youtube.com.evil.example/watch?v=abcdef")).toBeNull();
    expect(toEmbed("https://notinstagram.com/reel/AbC123/")).toBeNull();
  });

  it("cannot be used to smuggle markup into the iframe src", () => {
    const embed = toEmbed('https://www.instagram.com/reel/abc"><script>alert(1)</script>/');
    expect(embed).toBeNull();
  });
});

describe("safeExternalHref", () => {
  it("keeps http and https links", () => {
    expect(safeExternalHref("https://example.com/recipe")).toBe("https://example.com/recipe");
    expect(safeExternalHref("http://example.com/")).toBe("http://example.com/");
  });

  it("trims surrounding whitespace", () => {
    expect(safeExternalHref("  https://example.com/  ")).toBe("https://example.com/");
  });

  it("drops dangerous or unusable values", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(safeExternalHref("data:text/html,hi")).toBeNull();
    expect(safeExternalHref("")).toBeNull();
    expect(safeExternalHref(null)).toBeNull();
    expect(safeExternalHref("nonsense")).toBeNull();
  });
});
