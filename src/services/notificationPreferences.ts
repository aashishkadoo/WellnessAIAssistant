//src/services/notificationPreferences.ts

import { getDatabase } from "../database/database";

// ============================================================================
// TYPES
// ============================================================================

export type ReminderId =
  | "water"
  | "morning"
  | "walk"
  | "stretch"
  | "exercise"
  | "relax";

export type ReminderPreference = {
  id: ReminderId;
  title: string;
  description: string;
  enabled: boolean;

  // Used by single-time reminders.
  time: string;

  // Used by recurring water reminders.
  intervalHours?: number;
  startTime?: string;
  endTime?: string;
};

export type NotificationPreferences = {
  userId: string;
  enabled: boolean;
  reminders: Record<ReminderId, ReminderPreference>;

  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  createdAt: string;
  updatedAt: string;
};

type NotificationPreferenceRow = {
  user_id: string;
  enabled: number;
  reminders_json: string;
  quiet_hours_enabled: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  created_at: string;
  updated_at: string;
};

export type ReminderUpdates = Partial<
  Pick<
    ReminderPreference,
    "enabled" | "time" | "intervalHours" | "startTime" | "endTime"
  >
>;

export type NotificationPreferenceUpdates = Partial<
  Pick<
    NotificationPreferences,
    | "enabled"
    | "quietHoursEnabled"
    | "quietHoursStart"
    | "quietHoursEnd"
  >
>;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_REMINDERS: Record<
  ReminderId,
  ReminderPreference
> = {
  water: {
    id: "water",
    title: "Drink water",
    description: "Stay hydrated throughout the day.",
    enabled: true,
    time: "09:00",
    intervalHours: 2,
    startTime: "09:00",
    endTime: "19:00",
  },

  morning: {
    id: "morning",
    title: "Morning daylight",
    description: "Take a few minutes to enjoy natural daylight.",
    enabled: true,
    time: "10:00",
  },

  walk: {
    id: "walk",
    title: "Take a walk",
    description: "Move your body and take a short walk.",
    enabled: true,
    time: "13:00",
  },

  stretch: {
    id: "stretch",
    title: "Stretch break",
    description: "Relax your muscles and stretch.",
    enabled: true,
    time: "15:00",
  },

  exercise: {
    id: "exercise",
    title: "Exercise reminder",
    description: "Make time for your daily movement.",
    enabled: true,
    time: "17:00",
  },

  relax: {
    id: "relax",
    title: "Relaxation time",
    description: "Slow down with breathing or meditation.",
    enabled: true,
    time: "20:00",
  },
};

const DEFAULT_QUIET_HOURS_START = "22:00";
const DEFAULT_QUIET_HOURS_END = "07:00";

const REMINDER_IDS: ReminderId[] = [
  "water",
  "morning",
  "walk",
  "stretch",
  "exercise",
  "relax",
];

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate 24-hour HH:mm time format.
 */
export function isValidTime(value: string): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  return Boolean(match);
}

/**
 * Validate a user ID.
 */
function validateUserId(userId: string): void {
  if (
    typeof userId !== "string" ||
    userId.trim().length === 0
  ) {
    throw new Error(
      "[Notifications] A valid user ID is required.",
    );
  }
}

/**
 * Validate a reminder ID.
 */
function validateReminderId(
  reminderId: ReminderId,
): void {
  if (!REMINDER_IDS.includes(reminderId)) {
    throw new Error(
      `[Notifications] Unknown reminder: ${reminderId}`,
    );
  }
}

/**
 * Validate reminder settings.
 */
function validateReminder(
  reminder: ReminderPreference,
): void {
  if (!isValidTime(reminder.time)) {
    throw new Error(
      `[Notifications] Invalid reminder time: ${reminder.time}`,
    );
  }

  if (reminder.id === "water") {
    if (
      !Number.isInteger(reminder.intervalHours) ||
      !reminder.intervalHours ||
      reminder.intervalHours < 1 ||
      reminder.intervalHours > 12
    ) {
      throw new Error(
        "[Notifications] Water interval must be between 1 and 12 hours.",
      );
    }

    if (
      !reminder.startTime ||
      !isValidTime(reminder.startTime)
    ) {
      throw new Error(
        "[Notifications] Invalid water reminder start time.",
      );
    }

    if (
      !reminder.endTime ||
      !isValidTime(reminder.endTime)
    ) {
      throw new Error(
        "[Notifications] Invalid water reminder end time.",
      );
    }

    if (reminder.startTime >= reminder.endTime) {
      throw new Error(
        "[Notifications] Water reminder end time must be later than its start time.",
      );
    }
  }
}

/**
 * Validate the complete preference object.
 */
function validatePreferences(
  preferences: NotificationPreferences,
): void {
  validateUserId(preferences.userId);

  if (!isValidTime(preferences.quietHoursStart)) {
    throw new Error(
      "[Notifications] Invalid quiet-hours start time.",
    );
  }

  if (!isValidTime(preferences.quietHoursEnd)) {
    throw new Error(
      "[Notifications] Invalid quiet-hours end time.",
    );
  }

  for (const reminderId of REMINDER_IDS) {
    validateReminder(
      preferences.reminders[reminderId],
    );
  }
}

// ============================================================================
// DEFAULT PREFERENCES
// ============================================================================

/**
 * Generate default settings for a user.
 */
export function createDefaultNotificationPreferences(
  userId: string,
): NotificationPreferences {
  validateUserId(userId);

  const now = new Date().toISOString();

  return {
    userId,
    enabled: true,

    reminders: JSON.parse(
      JSON.stringify(DEFAULT_REMINDERS),
    ) as Record<ReminderId, ReminderPreference>,

    quietHoursEnabled: false,
    quietHoursStart: DEFAULT_QUIET_HOURS_START,
    quietHoursEnd: DEFAULT_QUIET_HOURS_END,

    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// JSON SERIALIZATION
// ============================================================================

/**
 * Safely parse reminder settings from SQLite.
 *
 * Missing or invalid reminder entries are restored using defaults.
 */
function parseReminders(
  remindersJson: string,
): Record<ReminderId, ReminderPreference> {
  const reminders = JSON.parse(
    remindersJson,
  ) as Partial<Record<ReminderId, Partial<ReminderPreference>>>;

  const result = {} as Record<
    ReminderId,
    ReminderPreference
  >;

  for (const reminderId of REMINDER_IDS) {
    const defaults = DEFAULT_REMINDERS[reminderId];
    const saved = reminders?.[reminderId];

    const merged: ReminderPreference = {
      ...defaults,
      ...saved,
      id: reminderId,
    };

    // Prevent corrupted values from breaking the scheduler.
    if (typeof merged.enabled !== "boolean") {
      merged.enabled = defaults.enabled;
    }

    if (!isValidTime(merged.time)) {
      merged.time = defaults.time;
    }

    if (reminderId === "water") {
      if (
        !Number.isInteger(merged.intervalHours) ||
        !merged.intervalHours ||
        merged.intervalHours < 1 ||
        merged.intervalHours > 12
      ) {
        merged.intervalHours = defaults.intervalHours;
      }

      if (
        !merged.startTime ||
        !isValidTime(merged.startTime)
      ) {
        merged.startTime = defaults.startTime;
      }

      if (
        !merged.endTime ||
        !isValidTime(merged.endTime)
      ) {
        merged.endTime = defaults.endTime;
      }
    }

    result[reminderId] = merged;
  }

  return result;
}

// ============================================================================
// DATABASE MAPPING
// ============================================================================

/**
 * Convert a SQLite row into application preferences.
 */
function mapDatabaseRow(
  row: NotificationPreferenceRow,
): NotificationPreferences {
  let reminders: Record<
    ReminderId,
    ReminderPreference
  >;

  try {
    reminders = parseReminders(row.reminders_json);
  } catch (error) {
    console.warn(
      "[Notifications] Invalid saved reminder JSON. Restoring defaults.",
      error,
    );

    reminders = parseReminders("{}");
  }

  return {
    userId: row.user_id,

    enabled: row.enabled === 1,

    reminders,

    quietHoursEnabled:
      row.quiet_hours_enabled === 1,

    quietHoursStart: isValidTime(row.quiet_hours_start)
      ? row.quiet_hours_start
      : DEFAULT_QUIET_HOURS_START,

    quietHoursEnd: isValidTime(row.quiet_hours_end)
      ? row.quiet_hours_end
      : DEFAULT_QUIET_HOURS_END,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Read notification preferences from SQLite.
 */
function readPreferences(
  userId: string,
): NotificationPreferences | null {
  const db = getDatabase();

  const result = db.execute<NotificationPreferenceRow>(
    `SELECT
       user_id,
       enabled,
       reminders_json,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       created_at,
       updated_at
     FROM notification_preferences
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  const row = result.rows._array[0];

  if (!row) {
    return null;
  }

  return mapDatabaseRow(row);
}

/**
 * Persist complete notification preferences.
 *
 * SQLite is the local source of truth.
 * No internet connection is required.
 */
function writePreferences(
  preferences: NotificationPreferences,
): void {
  validatePreferences(preferences);

  const db = getDatabase();

  const remindersJson = JSON.stringify(
    preferences.reminders,
  );

  db.execute(
    `INSERT INTO notification_preferences (
       user_id,
       enabled,
       reminders_json,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       created_at,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id)
     DO UPDATE SET
       enabled = excluded.enabled,
       reminders_json = excluded.reminders_json,
       quiet_hours_enabled = excluded.quiet_hours_enabled,
       quiet_hours_start = excluded.quiet_hours_start,
       quiet_hours_end = excluded.quiet_hours_end,
       updated_at = excluded.updated_at`,
    [
      preferences.userId,
      preferences.enabled ? 1 : 0,
      remindersJson,
      preferences.quietHoursEnabled ? 1 : 0,
      preferences.quietHoursStart,
      preferences.quietHoursEnd,
      preferences.createdAt,
      preferences.updatedAt,
    ],
  );
}

// ============================================================================
// PUBLIC API — LOAD
// ============================================================================

/**
 * Load preferences for the authenticated user.
 *
 * If no settings exist yet, default preferences are created
 * and saved locally.
 */
export function getNotificationPreferences(
  userId: string,
): NotificationPreferences {
  validateUserId(userId);

  const existing = readPreferences(userId);

  if (existing) {
    return existing;
  }

  const defaults =
    createDefaultNotificationPreferences(userId);

  writePreferences(defaults);

  console.log(
    "[Notifications] Default preferences created for user.",
  );

  return defaults;
}

// ============================================================================
// PUBLIC API — SAVE
// ============================================================================

/**
 * Save changes to the master switch and quiet hours.
 */
export function updateNotificationPreferences(
  userId: string,
  updates: NotificationPreferenceUpdates,
): NotificationPreferences {
  const current = getNotificationPreferences(userId);

  const updated: NotificationPreferences = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  validatePreferences(updated);

  writePreferences(updated);

  return updated;
}

/**
 * Update an individual reminder.
 */
export function updateReminderPreference(
  userId: string,
  reminderId: ReminderId,
  updates: ReminderUpdates,
): NotificationPreferences {
  validateReminderId(reminderId);

  const current = getNotificationPreferences(userId);

  const currentReminder = current.reminders[reminderId];

  const updatedReminder: ReminderPreference = {
    ...currentReminder,
    ...updates,
    id: reminderId,
  };

  validateReminder(updatedReminder);

  const updated: NotificationPreferences = {
    ...current,

    reminders: {
      ...current.reminders,
      [reminderId]: updatedReminder,
    },

    updatedAt: new Date().toISOString(),
  };

  writePreferences(updated);

  return updated;
}

/**
 * Reset notification preferences to their defaults.
 */
export function resetNotificationPreferences(
  userId: string,
): NotificationPreferences {
  const defaults =
    createDefaultNotificationPreferences(userId);

  writePreferences(defaults);

  return defaults;
}

// ============================================================================
// PUBLIC API — DELETE
// ============================================================================

/**
 * Delete preferences belonging to a user.
 *
 * This only deletes notification settings.
 * It does not delete their profile or wellness records.
 */
export function deleteNotificationPreferences(
  userId: string,
): void {
  validateUserId(userId);

  const db = getDatabase();

  db.execute(
    `DELETE FROM notification_preferences
     WHERE user_id = ?`,
    [userId],
  );
}

// ============================================================================
// PUBLIC API — UTILITIES
// ============================================================================

/**
 * Check whether a particular reminder is enabled.
 */
export function isReminderEnabled(
  preferences: NotificationPreferences,
  reminderId: ReminderId,
): boolean {
  return (
    preferences.enabled &&
    preferences.reminders[reminderId].enabled
  );
}

/**
 * Convert HH:mm into minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  if (!isValidTime(time)) {
    throw new Error(
      `[Notifications] Invalid time: ${time}`,
    );
  }

  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

/**
 * Check whether a given time falls inside quiet hours.
 *
 * Supports overnight quiet hours such as 22:00–07:00.
 */
export function isWithinQuietHours(
  time: string,
  startTime: string,
  endTime: string,
): boolean {
  if (
    !isValidTime(time) ||
    !isValidTime(startTime) ||
    !isValidTime(endTime)
  ) {
    return false;
  }

  const current = timeToMinutes(time);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start === end) {
    // Equal times represent a full-day quiet period.
    return true;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

/**
 * Return a human-readable interval.
 */
export function formatReminderInterval(
  hours: number,
): string {
  if (hours === 1) {
    return "Every hour";
  }

  return `Every ${hours} hours`;
}
