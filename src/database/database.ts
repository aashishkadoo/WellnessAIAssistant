// src/database/database.ts
import { open } from "react-native-nitro-sqlite";
import { DATABASE_SCHEMA } from "./schema";

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const DATABASE_NAME = "wellness_ai.db";

/**
 * Version 2: Existing application schema.
 * Version 3: Offline profile-picture support and synchronization indexes.
 * Version 4: Local avatar data and pending avatar upload tracking.
 * Version 5: Offline notification preferences and reminder configuration.
 * Version 6: Local AI conversations and message history.
 */
const SCHEMA_VERSION = 6;

const BASELINE_SCHEMA_VERSION = 2;

type Database = ReturnType<typeof open>;

type DatabaseColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type DatabaseObject = {
  type: string;
  name: string;
  tbl_name: string;
};

let database: Database | null = null;
let initializationPromise: Promise<Database> | null = null;

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

/**
 * Returns the shared SQLite connection.
 * Opens the connection only once.
 */
export function getDatabase(): Database {
  if (!database) {
    database = open({ name: DATABASE_NAME });
  }

  return database;
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function tableExists(
  db: Database,
  tableName: string,
): boolean {
  const result = db.execute<{ name: string }>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name = ?`,
    [tableName],
  );

  return result.rows._array.length > 0;
}

function getTableColumns(
  db: Database,
  tableName: string,
): DatabaseColumn[] {
  if (!tableExists(db, tableName)) {
    return [];
  }

  const result = db.execute<DatabaseColumn>(
    `PRAGMA table_info(${quoteIdentifier(tableName)})`,
  );

  return result.rows._array;
}

function ensureColumn(
  db: Database,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): void {
  if (!tableExists(db, tableName)) {
    throw new Error(
      `[SQLite Migration] Cannot add ${columnName}: table ${tableName} does not exist.`,
    );
  }

  const columns = getTableColumns(db, tableName);

  const columnExists = columns.some(
    (column) => column.name === columnName,
  );

  if (columnExists) {
    return;
  }

  db.execute(
    `ALTER TABLE ${quoteIdentifier(tableName)}
     ADD COLUMN ${quoteIdentifier(columnName)}
     ${columnDefinition}`,
  );

  console.log(
    `[SQLite Migration] Added ${tableName}.${columnName}`,
  );
}

function ensureIndex(
  db: Database,
  indexName: string,
  tableName: string,
  columns: string,
): void {
  if (!tableExists(db, tableName)) {
    throw new Error(
      `[SQLite Migration] Cannot create index ${indexName}: table ${tableName} does not exist.`,
    );
  }

  db.execute(
    `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(indexName)}
     ON ${quoteIdentifier(tableName)} (${columns})`,
  );
}

// ============================================================================
// NOTIFICATION DATABASE HELPERS
// ============================================================================

function ensureNotificationPreferencesTable(
  db: Database,
): void {
  db.execute(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY NOT NULL,

      enabled INTEGER NOT NULL DEFAULT 1
        CHECK (enabled IN (0, 1)),

      reminders_json TEXT NOT NULL DEFAULT '{}',

      quiet_hours_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (quiet_hours_enabled IN (0, 1)),

      quiet_hours_start TEXT NOT NULL DEFAULT '22:00',

      quiet_hours_end TEXT NOT NULL DEFAULT '07:00',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  ensureIndex(
    db,
    "idx_notification_preferences_updated",
    "notification_preferences",
    "updated_at",
  );

  console.log(
    "[SQLite] Notification preferences table verified.",
  );
}

function verifyNotificationPreferencesTable(
  db: Database,
): void {
  const requiredColumns = [
    "user_id",
    "enabled",
    "reminders_json",
    "quiet_hours_enabled",
    "quiet_hours_start",
    "quiet_hours_end",
    "created_at",
    "updated_at",
  ];

  const columns = getTableColumns(
    db,
    "notification_preferences",
  );

  for (const columnName of requiredColumns) {
    const exists = columns.some(
      (column) => column.name === columnName,
    );

    if (!exists) {
      throw new Error(
        `[SQLite] Notification preferences verification failed: ${columnName} is missing.`,
      );
    }
  }
}

// ============================================================================
// AI CHAT DATABASE HELPERS — VERSION 6
// ============================================================================

/**
 * Creates local AI conversation storage.
 *
 * Privacy:
 * - Chat messages remain in local SQLite.
 * - They are not automatically uploaded to Supabase.
 * - Journal entries are stored separately.
 * - Deleting a conversation also deletes its messages.
 */
function ensureAiChatTables(db: Database): void {
  db.execute(`
    CREATE TABLE IF NOT EXISTS ai_chat_conversations (
      id TEXT PRIMARY KEY NOT NULL,

      user_id TEXT NOT NULL,

      title TEXT NOT NULL DEFAULT 'New conversation',

      created_at TEXT NOT NULL,

      updated_at TEXT NOT NULL,

      last_message_at TEXT,

      is_archived INTEGER NOT NULL DEFAULT 0
        CHECK (is_archived IN (0, 1))
    )
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY NOT NULL,

      conversation_id TEXT NOT NULL,

      user_id TEXT NOT NULL,

      sender TEXT NOT NULL
        CHECK (sender IN ('user', 'ai')),

      content TEXT NOT NULL,

      created_at TEXT NOT NULL,

      delivery_status TEXT NOT NULL DEFAULT 'saved'
        CHECK (
          delivery_status IN (
            'saved',
            'pending',
            'sent',
            'failed'
          )
        ),

      metadata TEXT,

      FOREIGN KEY (conversation_id)
        REFERENCES ai_chat_conversations(id)
        ON DELETE CASCADE
    )
  `);

  ensureIndex(
    db,
    "idx_ai_chat_conversations_user_updated",
    "ai_chat_conversations",
    "user_id, updated_at",
  );

  ensureIndex(
    db,
    "idx_ai_chat_conversations_last_message",
    "ai_chat_conversations",
    "user_id, last_message_at",
  );

  ensureIndex(
    db,
    "idx_ai_chat_messages_conversation",
    "ai_chat_messages",
    "conversation_id, created_at",
  );

  ensureIndex(
    db,
    "idx_ai_chat_messages_user",
    "ai_chat_messages",
    "user_id, created_at",
  );

  console.log(
    "[SQLite] AI chat tables and indexes verified.",
  );
}

/**
 * Verify the AI chat schema.
 */
function verifyAiChatTables(db: Database): void {
  const requiredTables: Record<string, string[]> = {
    ai_chat_conversations: [
      "id",
      "user_id",
      "title",
      "created_at",
      "updated_at",
      "last_message_at",
      "is_archived",
    ],

    ai_chat_messages: [
      "id",
      "conversation_id",
      "user_id",
      "sender",
      "content",
      "created_at",
      "delivery_status",
      "metadata",
    ],
  };

  for (const [tableName, requiredColumns] of Object.entries(
    requiredTables,
  )) {
    if (!tableExists(db, tableName)) {
      throw new Error(
        `[SQLite] AI chat table is missing: ${tableName}`,
      );
    }

    const columns = getTableColumns(db, tableName);

    for (const columnName of requiredColumns) {
      const exists = columns.some(
        (column) => column.name === columnName,
      );

      if (!exists) {
        throw new Error(
          `[SQLite] AI chat verification failed: ${tableName}.${columnName} is missing.`,
        );
      }
    }
  }
}

// ============================================================================
// SCHEMA VERSION MANAGEMENT
// ============================================================================

function getCurrentSchemaVersion(
  db: Database,
): number {
  const result = db.execute<{ value: string }>(
    `SELECT value
     FROM app_meta
     WHERE key = ?`,
    ["schema_version"],
  );

  const storedVersion = result.rows._array[0]?.value;

  if (!storedVersion) {
    return BASELINE_SCHEMA_VERSION;
  }

  const parsedVersion = Number.parseInt(
    storedVersion,
    10,
  );

  if (
    !Number.isFinite(parsedVersion) ||
    parsedVersion < 0
  ) {
    throw new Error(
      `[SQLite] Invalid stored schema version: ${storedVersion}`,
    );
  }

  return parsedVersion;
}

function setSchemaVersion(
  db: Database,
  version: number,
): void {
  db.execute(
    `INSERT OR REPLACE INTO app_meta (key, value)
     VALUES (?, ?)`,
    ["schema_version", String(version)],
  );
}

// ============================================================================
// VERSIONED DATABASE MIGRATIONS
// ============================================================================

type Migration = (db: Database) => void;

const migrations: Record<number, Migration> = {
  // --------------------------------------------------------------------------
  // VERSION 3 — PROFILE PICTURE SUPPORT
  // --------------------------------------------------------------------------

  3: (db) => {
    ensureColumn(
      db,
      "profiles",
      "local_avatar_uri",
      "TEXT",
    );

    ensureIndex(
      db,
      "idx_profiles_updated_at",
      "profiles",
      "updated_at",
    );

    ensureIndex(
      db,
      "idx_sync_queue_status_created_at",
      "sync_queue",
      "status, created_at",
    );

    ensureIndex(
      db,
      "idx_sync_queue_user_status",
      "sync_queue",
      "user_id, status",
    );

    ensureIndex(
      db,
      "idx_sync_queue_record",
      "sync_queue",
      "table_name, record_id",
    );

    console.log(
      "[SQLite Migration] Version 3 completed.",
    );
  },

  // --------------------------------------------------------------------------
  // VERSION 4 — LOCAL AVATAR DATA
  // --------------------------------------------------------------------------

  4: (db) => {
    ensureColumn(
      db,
      "profiles",
      "avatar_local_data",
      "TEXT",
    );

    ensureColumn(
      db,
      "profiles",
      "avatar_needs_upload",
      "INTEGER NOT NULL DEFAULT 0",
    );

    console.log(
      "[SQLite Migration] Version 4 completed.",
    );
  },

  // --------------------------------------------------------------------------
  // VERSION 5 — NOTIFICATION PREFERENCES
  // --------------------------------------------------------------------------

  5: (db) => {
    ensureNotificationPreferencesTable(db);

    verifyNotificationPreferencesTable(db);

    console.log(
      "[SQLite Migration] Version 5 completed.",
    );
  },

  // --------------------------------------------------------------------------
  // VERSION 6 — AI CHAT STORAGE
  // --------------------------------------------------------------------------

  6: (db) => {
    ensureAiChatTables(db);

    verifyAiChatTables(db);

    console.log(
      "[SQLite Migration] Version 6 completed.",
    );
  },
};

/**
 * Apply migrations newer than the installed version.
 *
 * Migrations run in ascending order.
 * Existing user data is preserved.
 */
function runMigrations(
  db: Database,
  currentVersion: number,
): void {
  const targetVersion = SCHEMA_VERSION;

  if (currentVersion > targetVersion) {
    throw new Error(
      `[SQLite] Database schema version ${currentVersion} is newer than supported version ${targetVersion}.`,
    );
  }

  for (
    let version = currentVersion + 1;
    version <= targetVersion;
    version += 1
  ) {
    const migration = migrations[version];

    if (!migration) {
      throw new Error(
        `[SQLite Migration] Missing migration for version ${version}.`,
      );
    }

    console.log(
      `[SQLite Migration] Applying version ${version}...`,
    );

    migration(db);

    setSchemaVersion(db, version);

    console.log(
      `[SQLite Migration] Version ${version} applied.`,
    );
  }

  // --------------------------------------------------------------------------
  // REPAIR CHECKS
  // --------------------------------------------------------------------------

  ensureColumn(
    db,
    "profiles",
    "local_avatar_uri",
    "TEXT",
  );

  ensureColumn(
    db,
    "profiles",
    "avatar_local_data",
    "TEXT",
  );

  ensureColumn(
    db,
    "profiles",
    "avatar_needs_upload",
    "INTEGER NOT NULL DEFAULT 0",
  );

  ensureIndex(
    db,
    "idx_profiles_updated_at",
    "profiles",
    "updated_at",
  );

  ensureIndex(
    db,
    "idx_sync_queue_status_created_at",
    "sync_queue",
    "status, created_at",
  );

  ensureIndex(
    db,
    "idx_sync_queue_user_status",
    "sync_queue",
    "user_id, status",
  );

  ensureIndex(
    db,
    "idx_sync_queue_record",
    "sync_queue",
    "table_name, record_id",
  );

  // Notification table repair.
  ensureNotificationPreferencesTable(db);

  verifyNotificationPreferencesTable(db);

  // AI chat table repair.
  ensureAiChatTables(db);

  verifyAiChatTables(db);

  setSchemaVersion(db, targetVersion);
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

/**
 * Initialize SQLite and apply migrations.
 *
 * Features:
 * - Shared database connection.
 * - Safe repeated initialization.
 * - Existing data preservation.
 * - Versioned migrations.
 * - Notification preference persistence.
 * - Local AI chat persistence.
 * - Automatic recovery after failed initialization attempts.
 */
export async function initializeDatabase(): Promise<Database> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log(
      "[SQLite] Opening database:",
      DATABASE_NAME,
    );

    const db = getDatabase();

    try {
      // ----------------------------------------------------------------------
      // 1. Ensure application metadata exists.
      // ----------------------------------------------------------------------

      db.execute(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        )
      `);

      // ----------------------------------------------------------------------
      // 2. Execute base application schema.
      // ----------------------------------------------------------------------

      const statements = DATABASE_SCHEMA
        .split(";")
        .map((statement) => statement.trim())
        .filter(
          (statement) => statement.length > 0,
        );

      for (const statement of statements) {
        db.execute(statement);
      }

      console.log(
        "[SQLite] Base schema statements executed.",
      );

      // ----------------------------------------------------------------------
      // 3. Verify required base tables.
      // ----------------------------------------------------------------------

      const requiredTables = [
        "app_meta",
        "profiles",
        "sync_queue",
      ];

      for (const tableName of requiredTables) {
        if (!tableExists(db, tableName)) {
          throw new Error(
            `[SQLite] Required table is missing: ${tableName}`,
          );
        }
      }

      // ----------------------------------------------------------------------
      // 4. Read installed schema version.
      // ----------------------------------------------------------------------

      const currentVersion =
        getCurrentSchemaVersion(db);

      console.log(
        `[SQLite] Current schema version: ${currentVersion}`,
      );

      // ----------------------------------------------------------------------
      // 5. Apply migrations.
      // ----------------------------------------------------------------------

      runMigrations(db, currentVersion);

      // ----------------------------------------------------------------------
      // 6. Verify profile-picture columns.
      // ----------------------------------------------------------------------

      const profileColumns = getTableColumns(
        db,
        "profiles",
      );

      const requiredProfileColumns = [
        "local_avatar_uri",
        "avatar_local_data",
        "avatar_needs_upload",
      ];

      for (const columnName of requiredProfileColumns) {
        const exists = profileColumns.some(
          (column) => column.name === columnName,
        );

        if (!exists) {
          throw new Error(
            `[SQLite] Profile-picture migration verification failed: ${columnName} is missing.`,
          );
        }
      }

      // ----------------------------------------------------------------------
      // 7. Verify notification preferences.
      // ----------------------------------------------------------------------

      verifyNotificationPreferencesTable(db);

      // ----------------------------------------------------------------------
      // 8. Verify AI chat storage.
      // ----------------------------------------------------------------------

      verifyAiChatTables(db);

      // ----------------------------------------------------------------------
      // 9. Verify installed version.
      // ----------------------------------------------------------------------

      const installedVersion =
        getCurrentSchemaVersion(db);

      if (installedVersion !== SCHEMA_VERSION) {
        throw new Error(
          `[SQLite] Expected schema version ${SCHEMA_VERSION}, found ${installedVersion}.`,
        );
      }

      console.log(
        `[SQLite] Database initialized successfully (schema ${SCHEMA_VERSION}).`,
      );

      return db;
    } catch (error) {
      // Permit a subsequent initialization attempt.
      initializationPromise = null;

      console.error(
        "[SQLite] Initialization failed:",
        error,
      );

      throw error;
    }
  })();

  return initializationPromise;
}

// ============================================================================
// DATABASE INSPECTION
// ============================================================================

/**
 * Inspect local tables, indexes, and columns.
 */
export function inspectDatabaseSchema(): void {
  const db = getDatabase();

  const objects = db.execute<DatabaseObject>(
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
      item.type === "table" &&
      !item.name.startsWith("sqlite_"),
  );

  for (const table of tables) {
    const columns = getTableColumns(
      db,
      table.name,
    );

    console.log(
      `[SQLite Inspection] Columns in ${table.name}:`,
      JSON.stringify(columns, null, 2),
    );
  }

  const version = getCurrentSchemaVersion(db);

  console.log(
    `[SQLite Inspection] Schema version: ${version}`,
  );
}
