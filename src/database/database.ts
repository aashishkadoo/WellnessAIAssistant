//src/database/database.ts
import { open } from "react-native-nitro-sqlite";
import { DATABASE_SCHEMA } from "./schema";

const DATABASE_NAME = "wellness_ai.db";

let database: ReturnType<typeof open> | null = null;

export function getDatabase() {
  if (!database) {
    database = open({
      name: DATABASE_NAME,
    });
  }

  return database;
}

export function initializeDatabase() {
  console.log("[SQLite] Opening database...");

  const db = getDatabase();

  console.log("[SQLite] Database opened");

  db.execute(DATABASE_SCHEMA);

  console.log("[SQLite] Schema created");

  db.execute(
    `
      INSERT OR IGNORE INTO app_meta (key, value)
      VALUES (?, ?)
    `,
    ["schema_version", "1"],
  );

  console.log("[SQLite] Database initialized:", DATABASE_NAME);

  return db;
}