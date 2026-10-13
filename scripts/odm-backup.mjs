import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.resolve(process.env.ODM_ROOT || scriptRoot);
const targetDir = path.resolve(process.argv[2] || path.join(os.homedir(), "odm-backups"));
const appPort = Number.parseInt(process.env.PORT || "3005", 10);

function fail(message) {
  console.error(`[odm-backup] ${message}`);
  process.exit(1);
}

async function portInUse(port) {
  return await new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

if (await portInUse(appPort)) {
  fail(`the app is listening on :${appPort}; stop it before taking a backup so the SQLite snapshot is consistent`);
}

const dbPath = path.resolve(process.env.SQLITE_DB_PATH || path.join(root, "data", "local-roleplay.sqlite"));
const relativeDb = path.relative(root, dbPath);
if (relativeDb.startsWith("..") || path.isAbsolute(relativeDb)) {
  fail(`SQLITE_DB_PATH must live under the ODM root for a portable backup: ${dbPath}`);
}

if (!fs.existsSync(dbPath)) {
  fail(`database not found: ${dbPath}`);
}

import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(dbPath);
try {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const rows = db.prepare("PRAGMA integrity_check").all();
  const integrity = String(rows[0] ? Object.values(rows[0])[0] : "");
  if (integrity !== "ok") fail(`database integrity check failed: ${integrity}`);
} finally {
  db.close();
}

fs.mkdirSync(targetDir, { recursive: true });
try {
  fs.chmodSync(targetDir, 0o700);
} catch {
  // chmod is best-effort on Windows.
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "odm-backup-"));
const includes = ["data", "public/uploads", "public/generated", "models", ".env.server"];
try {
  for (const rel of includes) {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(stage, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true });
  }

  const manifest = {
    format: 1,
    createdAt: new Date().toISOString(),
    database: relativeDb.replaceAll(path.sep, "/"),
    includes: includes.filter((rel) => fs.existsSync(path.join(root, rel))),
  };
  fs.writeFileSync(path.join(stage, "odm-backup.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const stamp = manifest.createdAt.replace(/[:.]/g, "-").slice(0, 19);
  const archive = path.join(targetDir, `odm-backup-${stamp}.tar.gz`);
  execFileSync("tar", ["-czf", archive, "-C", stage, "."], { stdio: "pipe" });

  const sha = await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(archive);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
  const sizeMb = (fs.statSync(archive).size / 2 ** 20).toFixed(1);
  console.log(`backup: ${archive} (${sizeMb} MB)`);
  console.log(`sha256: ${sha}`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
