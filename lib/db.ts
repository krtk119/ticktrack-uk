import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

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

let dbInstance: Database.Database | null = null;

/**
 * Initializes and migrates the SQLite database schema.
 */
export function initSchema(db: Database.Database): void {
  // Use WAL mode for improved concurrent read/write performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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
export function setDb(db: Database.Database | null): void {
  if (dbInstance && dbInstance !== db) {
    dbInstance.close();
  }
  dbInstance = db;
}

/**
 * Returns the singleton SQLite database instance.
 * Automatically uses in-memory SQLite in test environments to prevent touching data/ticks.db.
 */
export function getDb(customPath?: string): Database.Database {
  if (customPath) {
    if (dbInstance) {
      dbInstance.close();
    }
    dbInstance = new Database(customPath);
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

    dbInstance = new Database(dbPath);
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
