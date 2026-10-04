import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";

/**
 * The lint rule that keeps a page from reaching a home-scoped model through raw `prisma`
 * is a guard on tenancy, and it was found switched off on nearly every screen: ESLint's
 * flat config does not merge a rule's options across blocks, so the later block listing
 * untranslated copy replaced it for every file both named. Nothing failed — a rule that is
 * not running reports nothing.
 *
 * So this lints a line as though it were written into real files, and asks for the error.
 * Loading the config pulls in Next's whole preset, hence the long timeout.
 */
const eslint = new ESLint();

async function messagesFor(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map((message) => message.message);
}

const reachingPantry = `import { prisma } from "@/lib/prisma";\nexport const rows = prisma.pantryItem.findMany();\n`;

describe("the tenancy lint rule", () => {
  it.each([
    // A screen also held to the untranslated-copy rule: where the two used to collide.
    "src/app/(app)/dashboard/page.tsx",
    "src/components/list-items.tsx",
    // One that is not.
    "src/components/photo.tsx",
  ])("runs on %s, for a model added after the rule was written", { timeout: 60_000 }, async (file) => {
    const messages = await messagesFor(file, reachingPantry);
    expect(messages.some((message) => message.includes("homeDb"))).toBe(true);
  });

  it("still leaves actions alone, where crossing homes can be the point", { timeout: 60_000 }, async () => {
    const messages = await messagesFor("src/app/actions/pantry.ts", reachingPantry);
    expect(messages.some((message) => message.includes("homeDb"))).toBe(false);
  });
});
