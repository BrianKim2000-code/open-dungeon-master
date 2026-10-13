// Promote an existing account to global admin (or demote with --revoke).
// Usage: node scripts/make-admin.mjs <username> [--revoke]
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath =
  process.env.SQLITE_DB_PATH || path.join(process.cwd(), "data", "local-roleplay.sqlite");

function fail(message) {
  console.error(`[make-admin] ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2).filter((arg) => arg !== "--revoke");
const revoke = process.argv.includes("--revoke");
const username = args[0];
if (!username) {
  fail("Usage: node scripts/make-admin.mjs <username> [--revoke]");
}

if (!existsSync(dbPath)) {
  fail(`No database at ${dbPath}. Start the app once (or register) first.`);
}

const db = new DatabaseSync(dbPath);
try {
  db.prepare("SELECT count(*) FROM sqlite_master").get();
} catch (error) {
  db.close();
  fail(`Could not open ${dbPath}: ${error.message}`);
}

const columns = db.prepare("PRAGMA table_info(users)").all();
if (!columns.some((column) => column.name === "is_admin")) {
  db.close();
  fail("The users table has no is_admin column yet. Start the app once to migrate, then rerun.");
}

const result = db
  .prepare("UPDATE users SET is_admin = ? WHERE username = ?")
  .run(revoke ? 0 : 1, username);
if (result.changes === 0) {
  const names = db.prepare("SELECT username FROM users ORDER BY username").all();
  db.close();
  fail(
    `No user named "${username}". Existing users: ${names.map((row) => row.username).join(", ") || "(none)"}`,
  );
}
db.close();
console.log(`[make-admin] ${revoke ? "Revoked admin from" : "Promoted"} "${username}".`);
