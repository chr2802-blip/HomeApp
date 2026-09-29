import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The other half of `language.test.ts`.
 *
 * That file holds every phrase in `src/lib/copy/` to saying something in both languages.
 * Nothing held a sentence that never made it there — and after the language work
 * landed, a Danish home was still reading English in the photo field on nine forms,
 * the "Add to list" refusals, "Cancel" on every dialog, and both error screens. Each was
 * found by one `grep`, which is the evidence that a mechanical check holds it.
 *
 * It walks `src/app` and `src/components` — never a list of its own — for the two
 * shapes a sentence a person reads takes there: a quoted string of two or more words
 * starting with a capital, and a JSX text node. `src/lib` is not walked: it holds the
 * importer's and action mode's prompts, which are English on purpose and read by a
 * model, and its rule is a different one — a lib module takes the language as an
 * argument, so a sentence written there has nobody's language to be said in.
 *
 * A false positive costs an entry below with its reason. A false negative costs a
 * household a sentence in the wrong language, which is the trade this file makes.
 */

const ROOTS = ["src/app", "src/components"];

/**
 * What may stay in English, and why. Keyed by file, so an exception cannot spread past
 * the one place it was argued for.
 */
const ALLOWED: Record<string, { strings: string[]; because: string }> = {
  "src/app/global-error.tsx": {
    strings: [
      "HomeHub could not load",
      "Something failed before the app could start. Trying again often clears it.",
      "Try again",
    ],
    because:
      "it replaces the root layout when that fails, so there is no session to read a language from and no provider above it",
  },
  "src/app/api/cron/reminders/route.ts": {
    strings: ["Reminder run failed"],
    because: "answered to the scheduler, not to a person",
  },
  "src/app/api/lists/sync/route.ts": {
    strings: ["Expected JSON", "Not a queue of changes"],
    because: "answered to the offline queue's own code, which reads the status and not the words",
  },
  "src/app/api/cook-timers/route.ts": {
    strings: ["Not a timer", "Not found"],
    because: "answered to action mode's own fetch, which reads the status and not the words",
  },
  "src/app/api/lists/[id]/version/route.ts": {
    strings: ["Not found"],
    because: "answered to `useListFollow`, which reads the status and not the words",
  },
  "src/app/api/photos/[id]/route.ts": {
    strings: ["Not found"],
    because: "the body of a 404 for an <img>, which nobody reads",
  },
  "src/app/(app)/bars/page.tsx": {
    strings: ["Bars", "What this device reports about the frame. Copy it and send it on."],
    because: "the measuring stick the audits list as dead code; it goes rather than being translated",
  },
  "src/components/bars-readout.tsx": {
    strings: ["Measuring…"],
    because: "the same measuring stick",
  },
};

/** The one word that is the same in every language because it is a name. */
const NAMES = new Set(["HomeHub"]);

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

/** Comments say why, in English, to whoever reads the code — never to a household. */
function withoutComments(source: string) {
  return source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sentencesIn(source: string): string[] {
  const code = withoutComments(source);
  const found: string[] = [];

  // "Add a picture", `Nothing to add`, 'Try again' — two words or more, from a capital.
  // One word alone is left out: a lone capitalised string is far more often a key name
  // ("Escape"), a type or an id than a sentence, and every one-word label found so far
  // sat in JSX, which the second pattern reads whatever its length.
  for (const match of code.matchAll(/(["'`])([A-Z][a-z']*(?: [^"'`\n{}$<>]+)+)\1/g)) {
    found.push(match[2]!);
  }

  // >Cancel</ — text between tags, one word or many. Only where a closing tag follows,
  // which is what tells a text node from the space between `=>` and a generic's `<`.
  for (const match of code.matchAll(/>([^<>{}]*)<\//g)) {
    const text = match[1]!.trim();
    if (/^[A-Z][a-z]/.test(text)) found.push(text);
  }

  return found.filter((text) => !NAMES.has(text));
}

const files = ROOTS.flatMap(filesUnder).map((path) => relative(process.cwd(), path));

describe("what a household reads is said through the catalogue", () => {
  it("finds files to read, so an empty walk cannot pass", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)("%s writes no sentence of its own", (file) => {
    const allowed = new Set(ALLOWED[file]?.strings ?? []);
    const stray = sentencesIn(readFileSync(file, "utf8")).filter((text) => !allowed.has(text));

    expect(stray, "say it with sayIn(…) from a phrase in src/lib/copy/ — or argue for it in ALLOWED").toEqual([]);
  });

  it("allows nothing for a file that is gone, so an exception cannot outlive its reason", () => {
    for (const file of Object.keys(ALLOWED)) expect(files).toContain(file);
  });
});
