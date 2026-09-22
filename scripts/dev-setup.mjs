/**
 * Brings a cold container to the point where `npm run verify` can actually run.
 *
 * Every session note in `docs/sessions/` from 2026-09-20 onwards names the same cost as
 * its largest: the container arrives with no `node_modules`, a stopped Postgres cluster
 * and a pre-baked Chromium whose revision is behind the one the lockfile wants, so the
 * first twenty minutes go on standing up an environment rather than on the change. Seven
 * notes in ten say it. CLAUDE.md's Commands section already documents the incantation,
 * and that helped — the later notes say the warning saved them the diagnosis — but a
 * documented incantation is still typed out by hand every time. This is the same
 * knowledge as a fact instead of a ritual.
 *
 * Two modes, because they answer different questions:
 *
 *   node scripts/dev-setup.mjs          does the work, exits non-zero on what it cannot do
 *   node scripts/dev-setup.mjs check    says what is missing, changes nothing, always exits 0
 *
 * `check` is the SessionStart hook. It has to be fast and it has to be impossible to
 * fail: a hook that blocks the start of a session, or that can go red on a machine which
 * is merely set up differently, is a hook somebody switches off — and the same reasoning
 * already governs the session-note hook beside it.
 *
 * Each step probes before it acts and is safe to run twice. The script never touches an
 * existing `.env`: where one is already there and Postgres still will not answer, it
 * says so and stops rather than rewriting credentials it did not choose.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const CHECK = process.argv[2] === "check";
const ROOT = process.cwd();

/** The database this script creates when it is the one choosing the credentials. */
const LOCAL_DB = "homehub";
const LOCAL_PASSWORD = "postgres";

function say(line) {
  process.stdout.write(`${line}\n`);
}

function run(file, args, options = {}) {
  return spawnSync(file, args, { encoding: "utf8", ...options });
}

/*
 * `.env` is read by hand rather than through dotenv, because the first thing this script
 * has to answer is whether `node_modules` exists at all.
 */
function envFromFile() {
  const values = {};
  let text;
  try {
    text = readFileSync(path.join(ROOT, ".env"), "utf8");
  } catch {
    return values;
  }
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return values;
}

function databaseUrl() {
  return process.env.DATABASE_URL || envFromFile().DATABASE_URL || "";
}

// ── dependencies ────────────────────────────────────────────────────────────────────

const dependencies = {
  name: "dependencies",
  probe() {
    // The Playwright CLI is the check rather than the directory: a `node_modules` left
    // half-written by an interrupted install is the shape that reads as present.
    if (!existsSync(path.join(ROOT, "node_modules/playwright/cli.js"))) {
      return "node_modules is missing or incomplete";
    }
    return null;
  },
  fix() {
    execFileSync("npm", ["ci"], { stdio: "inherit" });
    return "ran npm ci";
  },
};

// ── the generated Prisma client ──────────────────────────────────────────────────────

const CLIENT = "node_modules/.prisma/client/index.js";
const SCHEMA = "prisma/schema.prisma";

const prismaClient = {
  name: "prisma client",
  probe() {
    const client = path.join(ROOT, CLIENT);
    if (!existsSync(client)) return "the Prisma client has not been generated";
    /*
     * A client older than the schema is the failure CLAUDE.md warns about from the other
     * end: `home-scoping.test.ts` walks `Prisma.dmmf`, which is whatever was last
     * generated, so a stale client fails the suite on a model sitting right there in
     * schema.prisma.
     */
    if (statSync(path.join(ROOT, SCHEMA)).mtimeMs > statSync(client).mtimeMs) {
      return "the Prisma client is older than prisma/schema.prisma";
    }
    return null;
  },
  fix() {
    execFileSync(
      process.execPath,
      [path.join(ROOT, "node_modules/prisma/build/index.js"), "generate"],
      { stdio: "inherit" },
    );
    return "generated the Prisma client";
  },
};

// ── Postgres ────────────────────────────────────────────────────────────────────────

function postgresAnswers(url) {
  if (!url) return false;
  const probe = run("psql", [url, "-tAc", "SELECT 1"], {
    env: { ...process.env, PGCONNECT_TIMEOUT: "3" },
  });
  return probe.status === 0;
}

/** The clusters `pg_lsclusters` knows about: `16 main 5432 down postgres …`. */
function clusters() {
  const listed = run("pg_lsclusters", ["--no-header"]);
  if (listed.status !== 0) return [];
  return listed.stdout
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((fields) => fields.length >= 4)
    .map(([version, cluster, port, status]) => ({ version, cluster, port, status }));
}

function asPostgres(sql, database = "postgres") {
  // The cluster is reached over its socket as the `postgres` system user, because the
  // whole reason this step exists is that no password has been set yet.
  return run("su", ["postgres", "-c", `psql -d ${database} -tAc ${JSON.stringify(sql)}`]);
}

const postgres = {
  name: "postgres",
  probe() {
    const url = databaseUrl();
    if (!url) return "no DATABASE_URL, and no .env to read one from";
    if (!postgresAnswers(url)) {
      const down = clusters().filter((c) => c.status !== "online");
      return down.length
        ? `Postgres is not answering (cluster ${down[0].version}/${down[0].cluster} is ${down[0].status})`
        : "Postgres is not answering at DATABASE_URL";
    }
    return null;
  },
  fix() {
    const done = [];

    for (const { version, cluster, status } of clusters()) {
      if (status === "online") continue;
      const started = run("pg_ctlcluster", [version, cluster, "start"]);
      if (started.status !== 0) {
        throw new Error(
          `could not start the ${version}/${cluster} cluster: ${(started.stderr || "").trim()}`,
        );
      }
      done.push(`started the ${version}/${cluster} cluster`);
    }

    /*
     * Past here the script would be choosing credentials. It may only do that when there
     * is no `.env`: an existing one was written by somebody, possibly against a database
     * holding real data, and a setup script is no place to reset a password or rewrite a
     * connection string it did not choose.
     */
    if (existsSync(path.join(ROOT, ".env"))) {
      if (postgresAnswers(databaseUrl())) return done.join(", ");
      throw new Error(
        ".env is already there and Postgres still will not answer it. Fix DATABASE_URL by " +
          "hand — this script will not rewrite credentials it did not write.",
      );
    }

    const altered = asPostgres(`ALTER USER postgres WITH PASSWORD '${LOCAL_PASSWORD}'`);
    if (altered.status !== 0) {
      throw new Error(`could not set the postgres password: ${(altered.stderr || "").trim()}`);
    }
    done.push("set the local postgres password");

    const exists = asPostgres(`SELECT 1 FROM pg_database WHERE datname = '${LOCAL_DB}'`);
    if (exists.stdout.trim() !== "1") {
      const created = asPostgres(`CREATE DATABASE "${LOCAL_DB}"`);
      if (created.status !== 0) {
        throw new Error(`could not create ${LOCAL_DB}: ${(created.stderr || "").trim()}`);
      }
      done.push(`created the ${LOCAL_DB} database`);
    }

    const url = `postgresql://postgres:${LOCAL_PASSWORD}@localhost:5432/${LOCAL_DB}`;
    writeFileSync(
      path.join(ROOT, ".env"),
      [
        "# Written by scripts/dev-setup.mjs for a local container. Not a deployment's .env:",
        "# the cluster it points at is on this machine only and holds nothing but test data.",
        "# .env.example is the annotated list of everything else the app can be told.",
        `DATABASE_URL="${url}"`,
        `DIRECT_URL="${url}"`,
        `AUTH_SECRET="${randomBytes(32).toString("hex")}"`,
        "",
      ].join("\n"),
    );
    done.push("wrote .env");

    if (!postgresAnswers(url)) throw new Error(`Postgres still will not answer at ${url}`);
    return done.join(", ");
  },
};

// ── Chromium ────────────────────────────────────────────────────────────────────────

/*
 * What Playwright wants is asked of Playwright, not guessed. `install --dry-run` prints
 * a block per browser:
 *
 *   Chrome for Testing 153.0.8010.12 (playwright chromium v1243)
 *     Install location:    /opt/pw-browsers/chromium-1243
 *     Download url:        https://…/linux64/chrome-linux64.zip
 *
 * The install location is the revision directory it will look in, and the archive's name
 * is the directory it would have unpacked inside it — which is the half that moves. The
 * binary is that directory without its platform suffix (`chrome-linux64` → `chrome`,
 * `chrome-headless-shell-linux64` → `chrome-headless-shell`). Every one of those is then
 * checked by running the thing, so a wrong reading is loud rather than a broken tree.
 */
const WANTED = ["chromium", "chromium-headless-shell"];
const BINARY_NAMES = ["chrome", "chrome-headless-shell", "headless_shell"];
const PLATFORM_SUFFIX = /-(linux64|linux|mac(-arm64)?|win(32|64)?)$/;

function playwrightPlan() {
  const out = execFileSync(
    process.execPath,
    [path.join(ROOT, "node_modules/playwright/cli.js"), "install", "--dry-run", "chromium"],
    { encoding: "utf8" },
  );
  const plan = [];
  for (const block of out.split(/\n(?=\S)/)) {
    const named = /\(playwright (\S+) v(\d+)\)/.exec(block);
    const location = /Install location:\s*(\S+)/.exec(block);
    const url = /Download url:\s*(\S+)/.exec(block);
    if (!named || !location || !url) continue;
    if (!WANTED.includes(named[1])) continue;
    const layout = path.basename(url[1]).replace(/\.zip$/, "");
    plan.push({
      name: named[1],
      revision: named[2],
      directory: location[1],
      layout,
      binary: layout.replace(PLATFORM_SUFFIX, ""),
    });
  }
  return plan;
}

function installedBinary(entry) {
  return path.join(entry.directory, entry.layout, entry.binary);
}

function isInstalled(entry) {
  return (
    existsSync(path.join(entry.directory, "INSTALLATION_COMPLETE")) &&
    existsSync(installedBinary(entry))
  );
}

/** The newest other revision of the same package sitting beside the wanted one. */
function donorFor(entry) {
  const parent = path.dirname(entry.directory);
  const prefix = path.basename(entry.directory).replace(/\d+$/, "");
  let names;
  try {
    names = readdirSync(parent);
  } catch {
    return null; // no browsers directory at all: the caller says to download instead
  }
  let best = null;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const revision = name.slice(prefix.length);
    if (!/^\d+$/.test(revision) || revision === entry.revision) continue;
    const root = path.join(parent, name);
    const found = findBinary(root);
    if (!found) continue;
    if (!best || Number(revision) > Number(best.revision)) best = { revision, root, ...found };
  }
  return best;
}

/** The executable inside a revision directory, and the directory holding it. */
function findBinary(directory, depth = 2) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isFile() && BINARY_NAMES.includes(entry.name)) {
      try {
        if (statSync(full).mode & 0o111) return { binary: full, layout: directory };
      } catch {
        /* unreadable; keep looking */
      }
    }
    if (entry.isDirectory() && depth > 0) {
      const found = findBinary(full, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

function linkOnce(target, link) {
  try {
    const stat = lstatSync(link);
    // A broken link is what an interrupted earlier run leaves; anything else is kept.
    if (stat.isSymbolicLink() && !existsSync(link)) unlinkSync(link);
    else return;
  } catch {
    /* not there yet */
  }
  symlinkSync(target, link);
}

function mirrorInto(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) mirrorInto(from, to);
    else linkOnce(from, to);
  }
}

/*
 * A per-file symlink tree, not a link to the revision directory: the layout inside it
 * changes between revisions, so the whole point is to put the donor's files at the paths
 * the wanted revision asks for. The resources have to land beside the binary — a chrome
 * without `icudtl.dat` next to it starts and then dies — so it is the donor's layout
 * *directory* that is mirrored onto the wanted layout name, and only the executable that
 * is additionally linked under the name the new revision calls it by.
 */
function mirror(entry, donor) {
  const wantedLayout = path.join(entry.directory, entry.layout);
  mkdirSync(entry.directory, { recursive: true });

  if (donor.layout === donor.root) {
    // A build with no layout directory at all: everything belongs beside the binary.
    mirrorInto(donor.root, wantedLayout);
  } else {
    for (const top of readdirSync(donor.root, { withFileTypes: true })) {
      const from = path.join(donor.root, top.name);
      if (!top.isDirectory()) linkOnce(from, path.join(entry.directory, top.name));
      else if (from === donor.layout) mirrorInto(from, wantedLayout);
      else mirrorInto(from, path.join(entry.directory, top.name));
    }
  }

  linkOnce(donor.binary, path.join(wantedLayout, entry.binary));

  const version = run(installedBinary(entry), ["--version"]);
  if (version.status !== 0) {
    throw new Error(
      `mirrored ${entry.name} ${donor.revision} → ${entry.revision}, but the result will ` +
        `not run: ${(version.stderr || version.stdout || "").trim()}`,
    );
  }
  return `${entry.name} ${donor.revision} → ${entry.revision}`;
}

const chromium = {
  name: "chromium",
  probe() {
    if (dependencies.probe()) return null; // asked again once the CLI is installed
    const missing = playwrightPlan().filter((entry) => !isInstalled(entry));
    if (!missing.length) return null;
    return `Playwright wants ${missing.map((m) => `${m.name} ${m.revision}`).join(" and ")}, which is not installed`;
  },
  fix() {
    const done = [];
    for (const entry of playwrightPlan()) {
      if (isInstalled(entry)) continue;
      const donor = donorFor(entry);
      if (!donor) {
        throw new Error(
          `no other revision of ${entry.name} to mirror from. Download it instead:\n` +
            "    npx playwright install chromium",
        );
      }
      done.push(mirror(entry, donor));
    }
    return done.join(", ");
  },
};

// ── the run ─────────────────────────────────────────────────────────────────────────

const steps = [dependencies, prismaClient, postgres, chromium];

/*
 * A probe that throws would take the SessionStart hook with it, and a hook that goes red
 * on a machine merely set up differently is a hook somebody switches off. So the throw
 * becomes the answer: whatever went wrong is the reason this step is not ready.
 */
function probeOf(step) {
  try {
    return step.probe();
  } catch (error) {
    return `could not be checked: ${error instanceof Error ? error.message : String(error)}`;
  }
}

if (CHECK) {
  const missing = steps.map((step) => [step, probeOf(step)]).filter(([, why]) => why);
  if (missing.length) {
    say("dev setup: this checkout is not ready to run the suites.");
    for (const [step, why] of missing) say(`  ${step.name}: ${why}`);
    say("  Run: npm run setup");
  }
  process.exit(0);
}

let failed = false;
for (const step of steps) {
  const why = probeOf(step);
  if (!why) {
    say(`setup: ${step.name} — already there.`);
    continue;
  }
  say(`setup: ${step.name} — ${why}.`);
  try {
    say(`setup: ${step.name} — ${step.fix()}.`);
  } catch (error) {
    say(`setup: ${step.name} — FAILED: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

/*
 * The one check that is worth more than all four probes: Playwright launching its own
 * browser. `--version` says a file runs; this says the browser suite can start, which is
 * the question. A headless launch is the headless shell, which is the half the mirroring
 * gets wrong most easily.
 */
if (!failed && !probeOf(chromium)) {
  try {
    const { chromium: playwright } = await import("playwright");
    const browser = await playwright.launch();
    await browser.close();
    say("setup: playwright — launched and closed a browser.");
  } catch (error) {
    say(`setup: playwright — FAILED to launch: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

say(failed ? "setup: something above needs doing by hand." : "setup: ready. npm run verify");
process.exit(failed ? 1 : 0);
