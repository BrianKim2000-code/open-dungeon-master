declare module "better-sqlite3" {
  class Database {
    constructor(filename: string, options?: any);
    prepare(sql: string): any;
    exec(sql: string): void;
    pragma(source: string, options?: any): any;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }
  export = Database;
}
