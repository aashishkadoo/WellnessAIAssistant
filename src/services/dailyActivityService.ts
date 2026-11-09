//src/services/dailyActivityService.ts
import {
  getDatabase,
  initializeDatabase,
} from "../database/database";

export type DailyActivity = {
  id: string;
  user_id: string;
  activity_type: string;
  activity_date: string;
  duration_minutes: number;
  completed: boolean;
  created_at: string;
};

export type LogDailyActivityOptions = {
  userId: string;
  activityType?: string;
  durationSeconds?: number;
  completed?: boolean;
  activityDate?: string;
};

type SqlRow = Record<string, any>;

function createUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);

      return (
        character === "x"
          ? random
          : (random & 0x3) | 0x8
      ).toString(16);
    },
  );
}

function getLocalDate(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function mapActivity(row: SqlRow): DailyActivity {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    activity_type: String(row.activity_type),
    activity_date: String(row.activity_date),
    duration_minutes: Number(row.duration_minutes ?? 0),
    completed: Boolean(row.completed),
    created_at: String(row.created_at),
  };
}

/**
 * Save a daily activity locally and queue it for Supabase backup.
 *
 * SQLite is the source of truth.
 * Supabase synchronisation is handled separately.
 */
export async function logDailyActivity(
  options: LogDailyActivityOptions,
): Promise<DailyActivity> {
  const userId = options.userId.trim();

  if (!userId) {
    throw new Error("A user ID is required.");
  }

  await initializeDatabase();

  const db = getDatabase();

  const now = new Date().toISOString();

  const id = createUUID();
  const queueId = createUUID();

  const activityType = options.activityType?.trim() || "exercise";

  const durationSeconds = Math.max(
    0,
    Math.floor(options.durationSeconds ?? 0),
  );

  const durationMinutes = Math.ceil(durationSeconds / 60);

  const activityDate = options.activityDate || getLocalDate();

  const completed = options.completed ?? true;

  const activity: DailyActivity = {
    id,
    user_id: userId,
    activity_type: activityType,
    activity_date: activityDate,
    duration_minutes: durationMinutes,
    completed,
    created_at: now,
  };

  // Supabase expects a boolean rather than SQLite's integer.
  const queuePayload = JSON.stringify(activity);

  try {
    await db.execute("BEGIN IMMEDIATE TRANSACTION");

    await db.execute(
      `INSERT INTO daily_activities (
        id,
        user_id,
        activity_type,
        activity_date,
        duration_minutes,
        completed,
        created_at,
        synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        userId,
        activityType,
        activityDate,
        durationMinutes,
        completed ? 1 : 0,
        now,
      ],
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
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        queueId,
        "daily_activities",
        id,
        userId,
        "INSERT",
        queuePayload,
        "pending",
        0,
        now,
        now,
      ],
    );

    await db.execute("COMMIT");

    return activity;
  } catch (error) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }

    throw error;
  }
}

/**
 * Retrieve daily activities from local SQLite.
 */
export async function getDailyActivities(
  userId: string,
  activityDate?: string,
): Promise<DailyActivity[]> {
  if (!userId.trim()) {
    return [];
  }

  await initializeDatabase();

  const db = getDatabase();

  const conditions = ["user_id = ?"];
  const params: string[] = [userId];

  if (activityDate) {
    conditions.push("activity_date = ?");
    params.push(activityDate);
  }

  const result = await db.execute<SqlRow>(
    `SELECT
      id,
      user_id,
      activity_type,
      activity_date,
      duration_minutes,
      completed,
      created_at
    FROM daily_activities
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC`,
    params,
  );

  return result.rows._array.map(mapActivity);
}
