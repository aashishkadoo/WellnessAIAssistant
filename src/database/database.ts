//src/database/database.ts


import { open } from "react-native-nitro-sqlite";
import { DATABASE_SCHEMA } from "./schema";

const DATABASE_NAME = "wellness_ai.db";
const SCHEMA_VERSION = "1";

let database: ReturnType<typeof open> | null = null;
let initializationPromise: Promise<ReturnType<typeof open>> | null = null;

export function getDatabase() {
  if (!database) {
    database = open({ name: DATABASE_NAME });
  }

  return database;
}

/**
 * Initializes the local database without deleting existing data.
 *
 * The app_meta table is created first because initialization stores
 * the local schema version in that table.
 */
export async function initializeDatabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log("[SQLite] Opening database:", DATABASE_NAME);

    const db = getDatabase();

    try {
      // Always create the metadata table before accessing it.
      db.execute(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);

      console.log("[SQLite] app_meta table is ready");

      // Execute each SQL statement separately.
      // This avoids relying on multi-statement execution.
      const statements = DATABASE_SCHEMA
        .split(";")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);

      for (const statement of statements) {
        db.execute(statement);
      }

      console.log("[SQLite] Schema statements executed");

      // Verify that app_meta exists before inserting the version.
      const tableCheck = db.execute<{ name: string }>(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name = ?`,
        ["app_meta"],
      );

      if (tableCheck.rows._array.length === 0) {
        throw new Error(
          "SQLite initialization failed: app_meta table does not exist.",
        );
      }

      db.execute(
        `INSERT OR IGNORE INTO app_meta (key, value)
         VALUES (?, ?)`,
        ["schema_version", SCHEMA_VERSION],
      );

      console.log("[SQLite] Database initialized successfully");

      return db;
    } catch (error) {
      // Permit a later retry if initialization fails.
      initializationPromise = null;

      console.error("[SQLite] Initialization failed:", error);
      throw error;
    }
  })();

  return initializationPromise;
}

export function inspectDatabaseSchema() {
  const db = getDatabase();

  const objects = db.execute<{
    type: string;
    name: string;
    tbl_name: string;
  }>(
    `SELECT type, name, tbl_name
     FROM sqlite_master
     WHERE type IN ('table', 'index')
     ORDER BY type, name`,
  );

  const objectRows = objects.rows._array;

  console.log(
    "[SQLite Inspection] Tables and indexes:",
    JSON.stringify(objectRows, null, 2),
  );

  const tables = objectRows.filter(
    (item) =>
      item.type === "table" && !item.name.startsWith("sqlite_"),
  );

  for (const table of tables) {
    const columns = db.execute<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>(
      `PRAGMA table_info("${table.name.replace(/"/g, '""')}")`,
    );

    console.log(
      `[SQLite Inspection] Columns in ${table.name}:`,
      JSON.stringify(columns.rows._array, null, 2),
    );
  }
}
