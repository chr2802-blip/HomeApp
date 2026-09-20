/**
 * The hooks behind `docs/sessions/`: ask, once, for the note a session owes.
 *
 * A change here goes idea -> branch -> verify -> PR -> merge -> production in one sitting,
 * and the only part of that which leaves no trace is where the time actually went. The
 * diff records what was built. Nothing records that twenty minutes went on finding out
 * which of two files owned a colour, so nothing can be improved about it either.
 *
 * One file, two jobs, chosen by the argument rather than by anything in the hook's JSON:
 *
 *   start   SessionStart. Writes down the commit this session opened on.
 *   check   Stop. Blocks once if the session changed something and logged nothing.
 *
 * **What counts as "this session" is the commit it started at, not the branch point.**
 * Comparing against `main` looks like the same question and is not: a checkout whose
 * `origin/main` is a hundred commits stale — which is every shallow clone, and every
 * container that has not fetched — reports the whole intervening history as this
 * session's work, and a hook that cries about a hundred files is a hook nobody reads.
 * The recorded HEAD cannot be stale, because this session wrote it.
 *
 * The record lives in `.git/claude/`, which is outside the working tree: nothing to
 * commit, nothing to gitignore, and it goes when the clone does.
 *
 * It asks and does not insist. `stop_hook_active` is true when the model is already
 * continuing because of a Stop hook, and that case returns immediately: a hook that
 * cannot be got past is a hook somebody switches off, and then nothing is logged at all.
 *
 * Failure here is silence, never a blocked session. A repository this cannot read, git
 * that is not there, JSON that does not parse — all of them exit 0. The cost of a missed
 * reminder is one missing note; the cost of a hook that wedges the session is the hook.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = "docs/sessions/";

// The directory's own furniture. Editing the template is not logging a session, and a
// session that improved the template and nothing else is exactly the one whose note would
// otherwise go missing.
const NOT_A_NOTE = new Set([`${LOG_DIR}README.md`, `${LOG_DIR}TEMPLATE.md`]);

function isNote(path) {
  return path.startsWith(LOG_DIR) && !NOT_A_NOTE.has(path);
}

function git(...args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** Whether a git command succeeds, for questions whose answer is silence either way. */
function gitOk(...args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hookInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

/**
 * Where this session's opening commit is written down. The id comes from the hook's own
 * JSON and is reduced to the characters a filename may hold — it is a key, not a name,
 * and a session without one simply shares the unkeyed file.
 */
function headFile(input) {
  const gitDir = git("rev-parse", "--absolute-git-dir");
  if (!gitDir) return null;

  const id = String(input.session_id ?? "").replace(/[^A-Za-z0-9_-]/g, "") || "session";
  return join(gitDir, "claude", `${id}.head`);
}

/**
 * Every path this session has touched: committed since it opened, and still sitting in
 * the working tree. A note is owed for either — work that is committed but not pushed is
 * still work somebody spent the afternoon on.
 *
 * With no opening commit on file — a session that was already running when these hooks
 * were installed — only the working tree is read. Under-reporting costs one reminder;
 * over-reporting costs the hook's credibility.
 */
function touchedPaths(startedAt) {
  const paths = new Set();

  if (startedAt && gitOk("cat-file", "-e", `${startedAt}^{commit}`)) {
    for (const line of git("diff", "--name-only", startedAt, "HEAD").split("\n")) {
      if (line) paths.add(line);
    }
  }

  // --porcelain pads a two-character status before the path; a rename carries both, and
  // the one that matters is where the file is now. `-uall` because the default collapses
  // a new directory to its own name: the very first session note lives in a `docs/`
  // nobody has committed yet, and would be reported as `docs/` and missed.
  for (const line of git("status", "--porcelain", "-uall").split("\n")) {
    if (!line) continue;
    const path = line.slice(3).split(" -> ").pop();
    if (path) paths.add(path.replace(/^"|"$/g, ""));
  }

  return [...paths];
}

function start(input) {
  const head = git("rev-parse", "HEAD");
  const file = headFile(input);
  if (!head || !file) return;

  try {
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, head);
  } catch {
    // A session that cannot write this simply gets the working-tree answer at the end.
  }
}

function check(input) {
  // Already continuing because of this hook. Asking twice is insisting.
  if (input.stop_hook_active) return;
  if (!git("rev-parse", "--git-dir")) return;

  const file = headFile(input);
  let startedAt = "";
  try {
    if (file) startedAt = readFileSync(file, "utf8").trim();
  } catch {
    startedAt = "";
  }

  const touched = touchedPaths(startedAt);
  if (touched.length === 0) return;
  if (touched.some(isNote)) return;

  const reason = [
    `This session changed ${touched.length} file(s) and wrote no session note.`,
    "",
    `Before finishing, add one file to ${LOG_DIR} named YYYY-MM-DD-slug.md, built from`,
    `${LOG_DIR}TEMPLATE.md, and commit it with the work it describes.`,
    "",
    "It is a note about the process, not the diff: where the time actually went, what",
    "should have been quicker, and what this session had to work out that CLAUDE.md",
    "should have told it. Where that last answer is now known, write it into CLAUDE.md",
    "in the same commit.",
    "",
    "If this session genuinely has nothing to log, say so and stop — this asks once.",
  ].join("\n");

  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

const input = hookInput();
if (process.argv[2] === "start") start(input);
else check(input);
