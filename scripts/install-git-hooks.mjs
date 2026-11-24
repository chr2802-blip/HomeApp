/**
 * Points git at the version-controlled hooks in .githooks, so the pre-push test gate
 * is set up by `npm install` rather than by hand on every machine.
 *
 * Never fails the install: there is no .git directory on a build server, and nothing is
 * pushed from one. This hook is the only test gate there is — no CI, and the Vercel build
 * runs no tests — so a checkout that pushes without it pushes untested code.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

if (!existsSync(join(root, ".git"))) {
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: root,
    stdio: "ignore",
  });
} catch {
  console.warn("Could not configure git hooks; pushes will not run tests locally.");
}
