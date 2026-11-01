import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import fs from "fs";
import path from "path";

/**
 * The database is Node's built-in SQLite (node:sqlite, Node 22.13+), so there is no
 * native package to download or compile. An earlier version used better-sqlite3, which
 * failed to install on Windows machines without C++ build tools.
 */
export type Db = DatabaseSync;

/** Named query parameters, e.g. { city: "Leeds" } for `@city`. */
export type SqlParams = Record<string, SQLInputValue>;

/**
 * Loaded at runtime with getBuiltinModule rather than a static import, so the bundler
 * never tries to resolve node:sqlite itself.
 */
export function openDatabase(filename: string): Db {
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
  return new DatabaseSync(filename);
}

/**
 * Runs fn inside a transaction: all of its writes are saved together, or none are.
 */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export interface SightingRow {
  id: string;
  date: string;
  city: string;
  species: string;
  latinName: string;
  source: "elanco" | "community";
  verified: number; // SQLite integer 0 or 1
  notes: string | null;
  imageUrl: string | null;
  created_at?: string;
}

export interface Sighting {
  id: string;
  date: string;
  city: string;
  species: string;
  latinName: string;
  source: "elanco" | "community";
  verified: boolean;
  notes: string | null;
  imageUrl: string | null;
}

export function rowToSighting(row: SightingRow): Sighting {
  return {
    id: row.id,
    date: row.date,
    city: row.city,
    species: row.species,
    latinName: row.latinName,
    source: row.source,
    verified: Boolean(row.verified),
    notes: row.notes,
    imageUrl: row.imageUrl,
  };
}

let dbInstance: Db | null = null;

/**
 * Initializes and migrates the SQLite database schema.
 */
export function initSchema(db: Db): void {
  // Use WAL mode for improved concurrent read/write performance
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sightings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      city TEXT NOT NULL,
      species TEXT NOT NULL,
      latinName TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('elanco', 'community')),
      verified INTEGER NOT NULL CHECK(verified IN (0, 1)),
      notes TEXT,
      imageUrl TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sightings_date ON sightings(date);
    CREATE INDEX IF NOT EXISTS idx_sightings_city ON sightings(city);
    CREATE INDEX IF NOT EXISTS idx_sightings_species ON sightings(species);
    CREATE INDEX IF NOT EXISTS idx_sightings_source ON sightings(source);

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

/**
 * Sets the active database instance (primarily for test isolation).
 */
export function setDb(db: Db | null): void {
  if (dbInstance && dbInstance !== db) {
    dbInstance.close();
  }
  dbInstance = db;
}

/**
 * Returns the singleton SQLite database instance.
 * Automatically uses in-memory SQLite in test environments to prevent touching data/ticks.db.
 */
export function getDb(customPath?: string): Db {
  if (customPath) {
    if (dbInstance) {
      dbInstance.close();
    }
    dbInstance = openDatabase(customPath);
    initSchema(dbInstance);
    return dbInstance;
  }

  if (!dbInstance) {
    const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    const dbPath =
      process.env.TEST_DB_PATH ||
      (isTest ? ":memory:" : path.join(process.cwd(), "data", "ticks.db"));

    if (dbPath !== ":memory:") {
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    dbInstance = openDatabase(dbPath);
    initSchema(dbInstance);
  }

  return dbInstance;
}

/**
 * Closes the database singleton connection (used during teardown/testing).
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
