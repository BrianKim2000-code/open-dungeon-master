// npm run setup: everything a fresh clone needs before its first start, in
// one command, safe to run again. It replaces the README's old list (build
// the content pack, build) and ends by
// saying how to start the server; the browser takes over from there with
// the one-time setup link the server prints and the guided setup
// (src/app/setup).
//
//   npm run setup               all of it
//   npm run setup -- --no-build  skip the production build (for npm run dev)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const build = !args.has("--no-build");

const bold = (text) => (process.stdout.isTTY ? `\x1b[1m${text}\x1b[0m` : text);
const gold = (text) => (process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text);
const dim = (text) => (process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text);
const step = (n, total, text) => console.log(`\n${gold(`[${n}/${total}]`)} ${bold(text)}`);
const note = (text) => console.log(`      ${text}`);

const total = build ? 4 : 3;
const warnings = [];

function run(script, extra = []) {
  // The scripts import TypeScript sources; Node's note about reparsing
  // them as modules is noise in a setup log.
  const result = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(root, "scripts", script), ...extra], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  return result.status === 0;
}

// 1. Node. The same range package.json's engines and the README name.
step(1, total, "Checking Node");
{
  const [major, minor] = process.versions.node.split(".").map(Number);
  const ok = (major === 22 && minor >= 18) || major === 24 || major >= 26;
  if (!ok) {
    console.error(`      Node ${process.versions.node} is too old or an odd release. Install Node 22.18+, 24 or 26+ and run this again.`);
    process.exit(1);
  }
  note(`Node ${process.versions.node}`);
}

// 2. Database: unencrypted in this simplified build, no key needed.
step(2, total, "The database");
{
  note("Unencrypted SQLite at data/local-roleplay.sqlite (no key needed).");
}

// 3. The content pack: every spell, feat, item, subclass and monster.
step(3, total, "The content pack (spells, feats, items, monsters)");
{
  const pack = process.env.CONTENT_DB_PATH || path.join(root, "data", "content", "open5e.sqlite");
  if (fs.existsSync(pack)) {
    note("Already built. Kept as it is (node scripts/import-open5e.mjs --refresh rebuilds it).");
  } else if (!run("import-open5e.mjs")) {
    warnings.push("The content pack did not build (no network?). The app runs on the smaller built-in SRD set until you run: node scripts/import-open5e.mjs");
  }
}

// 4. The production build.
if (build) {
  step(4, total, "Building the app (a few minutes, once)");
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error("\n      The build failed; the output above says why.");
    process.exit(1);
  }
}

for (const warning of warnings) {
  console.log(`\n${gold("Note:")} ${warning}`);
}

console.log(`
${bold("Ready.")} Start the server:

    ${gold(build ? "npm run start:lan" : "npm run dev:lan")}     ${dim("(port 3005, reachable from your network)")}

It prints a link with a one-time setup code. Open it in a browser on this
computer, make the admin account, and the guided setup takes it from there:
the storyteller (a local model, an API key or an agent program), pictures,
voice, who may join, and your own agent.
`);
