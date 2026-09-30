import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export const migrationsDir = fileURLToPath(new URL('../../migrations/', import.meta.url));

export function openDatabase(path = ':memory:'): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

export interface AppliedMigration { version: number; name: string }

// Migration files are named NNN_description.sql; NNN is the module range owner
// (0xx common, 1xx content, 2xx planning, 3xx scene, 4xx session, 5xx growth).
export function runMigrations(db: DatabaseSync, directory = migrationsDir): AppliedMigration[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migration (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);
  const applied = new Set((db.prepare('SELECT version FROM schema_migration').all() as Array<{ version: number }>).map((row) => Number(row.version)));
  const files = readdirSync(directory)
    .map((name) => ({ name, match: /^(\d{3})_[\w-]+\.sql$/.exec(name) }))
    .filter((item): item is { name: string; match: RegExpExecArray } => item.match !== null)
    .map((item) => ({ name: item.name, version: Number(item.match[1]) }))
    .sort((a, b) => a.version - b.version);
  const versions = new Set<number>();
  for (const file of files) {
    if (versions.has(file.version)) throw new Error(`Duplicate migration version ${file.version}`);
    versions.add(file.version);
  }
  const executed: AppliedMigration[] = [];
  for (const file of files) {
    if (applied.has(file.version)) continue;
    const sql = readFileSync(join(directory, file.name), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migration(version, name, applied_at) VALUES (?, ?, ?)').run(file.version, file.name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file.name} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    executed.push({ version: file.version, name: file.name });
  }
  return executed;
}
