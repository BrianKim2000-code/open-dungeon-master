// Ensures scripts that import "better-sqlite3" still work without the native
// module. The app's driver.ts uses node:sqlite directly, but many maintenance
// scripts import better-sqlite3 for convenience. If the package is not
// installed (it was removed to avoid native builds), create a tiny JS shim
// that wraps node:sqlite with the subset of the API those scripts use.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "node_modules", "better-sqlite3");
if (fs.existsSync(path.join(target, "index.js"))) {
  // Already present - package installed or shim already created.
  process.exit(0);
}
if (fs.existsSync(path.join(root, "node_modules", "better-sqlite3", "package.json"))) {
  // A real package is present (edge case where index.js missing)
  process.exit(0);
}
try {
  const stat = fs.statSync(path.join(root, "node_modules"));
  if (!stat.isDirectory()) throw new Error("no node_modules");
} catch {
  // No node_modules yet - npm will retry postinstall anyway.
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });
fs.writeFileSync(
  path.join(target, "index.js"),
  `
const { DatabaseSync } = (process.getBuiltinModule ? process.getBuiltinModule('node:sqlite') : require('node:sqlite')) || {};
let DB;
try { DB = DatabaseSync; } catch {}
if (!DB) { try { DB = require('node:sqlite').DatabaseSync; } catch {} }
class Statement {
  constructor(stmt) { this.stmt = stmt; }
  run(...params) { const r = this.stmt.run(...params); return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid }; }
  get(...params) { return this.stmt.get(...params); }
  all(...params) { return this.stmt.all(...params); }
}
class Database {
  constructor(file, options = {}) {
    if (!DB) throw new Error('node:sqlite not available');
    this.db = new DB(file, { readOnly: Boolean(options.readonly), enableForeignKeyConstraints: false, timeout: 5000 });
    this._depth = 0;
  }
  prepare(sql) { return new Statement(this.db.prepare(sql)); }
  exec(sql) { this.db.exec(sql); }
  pragma(source, opts) {
    const lower = String(source).toLowerCase();
    if (lower.startsWith('cipher') || lower.startsWith('key') || lower.startsWith('rekey')) return undefined;
    try {
      if (opts && opts.simple) { const row = this.db.prepare(\`PRAGMA \${source}\`).get(); return row ? Object.values(row)[0] : undefined; }
      return this.db.prepare(\`PRAGMA \${source}\`).all();
    } catch { return undefined; }
  }
  transaction(fn) {
    const db = this.db;
    return (...args) => {
      const nested = this._depth > 0;
      const name = \`odm_sp_\${this._depth}\`;
      db.exec(nested ? \`SAVEPOINT \${name}\` : "BEGIN");
      this._depth++;
      try { const r = fn(...args); db.exec(nested ? \`RELEASE \${name}\` : "COMMIT"); return r; } catch (e) { try { db.exec(nested ? \`ROLLBACK TO \${name}; RELEASE \${name}\` : "ROLLBACK"); } catch {} throw e; } finally { this._depth--; }
    };
  }
  close() { this.db.close(); }
}
module.exports = Database;
module.exports.default = Database;
module.exports.Database = Database;
`.trimStart(),
  "utf8",
);
fs.writeFileSync(
  path.join(target, "package.json"),
  JSON.stringify({ name: "better-sqlite3", version: "9.2.3", main: "index.js", type: "commonjs" }, null, 2),
  "utf8",
);
fs.writeFileSync(
  path.join(target, "index.d.ts"),
  `declare module "better-sqlite3" { class Database { constructor(filename: string, options?: any); prepare(sql: string): any; exec(sql: string): void; pragma(source: string, options?: any): any; transaction<T extends (...args: any[]) => any>(fn: T): T; close(): void; } export = Database; }`,
  "utf8",
);
console.log("[ensure-shim] created node_modules/better-sqlite3 shim for node:sqlite.");
