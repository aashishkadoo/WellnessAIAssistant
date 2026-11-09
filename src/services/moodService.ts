//src/services/moodService.ts

import { initializeDatabase, getDatabase } from "../database/database";

// ============================================================================
// TYPES
// ============================================================================

type LogMoodPayload = {
  user_id: string;
  mood: number;
  energy?: number;
  stress?: number;
  note?: string;
};

type MoodLog = {
  id: string;
  user_id: string;
  mood: number;
  energy: number | null;
  stress: number | null;
  note: string | null;
  logged_at: string;
  log_date: string;
  synced: number;
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a UUID v4 for records shared between SQLite and Supabase.
 * The ID stays unchanged when the sync service uploads the record.
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);

      const value =
        character === "x"
          ? random
          : (random & 0x3) | 0x8;

      return value.toString(16);
    }
  );
}

/**
 * Return the device's local calendar date.
 * Avoid using toISOString() for log_date because that uses UTC.
 */
function getLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validateRating(
  value: number | undefined,
  field: string
): void {
  if (
    value !== undefined &&
    (!Number.isInteger(value) || value < 1 || value > 5)
  ) {
    throw new Error(`${field} must be an integer between 1 and 5.`);
  }
}

// ============================================================================
// MOOD SERVICE
// ============================================================================

export const moodService = {
  /**
   * Save a mood locally and queue it for Supabase synchronisation.
   *
   * SQLite is the source of truth.
   * The central sync service is responsible for uploading pending records.
   */
  async logMood(payload: LogMoodPayload): Promise<MoodLog> {
    if (!payload.user_id?.trim()) {
      throw new Error("A valid user ID is required to log a mood.");
    }

    validateRating(payload.mood, "Mood");
    validateRating(payload.energy, "Energy");
    validateRating(payload.stress, "Stress");

    await initializeDatabase();

    const db = getDatabase();

    const id = generateUUID();
    const now = new Date();

    const loggedAt = now.toISOString();
    const logDate = getLocalDate(now);

    const moodRecord: MoodLog = {
      id,
      user_id: payload.user_id,
      mood: payload.mood,
      energy: payload.energy ?? null,
      stress: payload.stress ?? null,
      note: payload.note?.trim() || null,
      logged_at: loggedAt,
      log_date: logDate,
      synced: 0,
    };

    // Payload must match the Supabase mood_logs columns.
    const syncPayload = {
      id: moodRecord.id,
      user_id: moodRecord.user_id,
      mood: moodRecord.mood,
      energy: moodRecord.energy,
      stress: moodRecord.stress,
      note: moodRecord.note,
      logged_at: moodRecord.logged_at,
      log_date: moodRecord.log_date,
    };

    const queueId = generateUUID();

    try {
      // Both inserts must succeed or neither should be committed.
      await db.execute("BEGIN IMMEDIATE");

      await db.execute(
        `INSERT INTO mood_logs (
          id,
          user_id,
          mood,
          energy,
          stress,
          note,
          logged_at,
          log_date,
          synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          moodRecord.id,
          moodRecord.user_id,
          moodRecord.mood,
          moodRecord.energy,
          moodRecord.stress,
          moodRecord.note,
          moodRecord.logged_at,
          moodRecord.log_date,
          moodRecord.synced,
        ]
      );

      await db.execute(
        `INSERT INTO sync_queue (
          id,
          table_name,
          record_id,
          user_id,
          operation,
          payload,
          status,
          retry_count,
          last_error,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          queueId,
          "mood_logs",
          moodRecord.id,
          moodRecord.user_id,
          "INSERT",
          JSON.stringify(syncPayload),
          "pending",
          0,
          null,
          loggedAt,
          loggedAt,
        ]
      );

      await db.execute("COMMIT");

      return moodRecord;
    } catch (error) {
      try {
        await db.execute("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Mood transaction rollback failed:",
          rollbackError
        );
      }

      console.error("Local mood logging failed:", error);
      throw error;
    }
  },
};
