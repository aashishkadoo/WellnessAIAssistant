//src/services/notificationScheduler.ts

import notifee, {
  AndroidImportance,
  AndroidNotificationSetting,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";

import {
  getNotificationPreferences,
  isWithinQuietHours,
  isValidTime,
  NotificationPreferences,
  ReminderPreference,
  ReminderId,
  timeToMinutes,
} from "./notificationPreferences";

// ============================================================================
// CONFIGURATION
// ============================================================================

export const WELLNESS_CHANNEL_ID = "wellness_reminders";

const CHANNEL_NAME = "Wellness reminders";
const NOTIFICATION_ID_PREFIX = "wellness_reminder";

const MAX_TIMESTAMP_TRIGGERS = 45;

type ScheduleResult = {
  scheduled: number;
  cancelled: number;
  skipped: number;
  permissionGranted: boolean;
  exactAlarmEnabled: boolean;
};

type ScheduledReminder = {
  id: string;
  title: string;
  body: string;
  reminderId: ReminderId;
  timestamp: number;
};

// ============================================================================
// CHANNEL
// ============================================================================

/**
 * Create the Android notification channel.
 *
 * Android requires a channel before notifications can be displayed.
 */
export async function createNotificationChannel(): Promise<void> {
  await notifee.createChannel({
    id: WELLNESS_CHANNEL_ID,
    name: CHANNEL_NAME,
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [300, 500],
    sound: "default",
  });
}

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Request notification permissions.
 *
 * Android 13+ displays a runtime notification permission prompt.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();

    return (
      settings.authorizationStatus >= 1
    );
  } catch (error) {
    console.error(
      "[NotificationScheduler] Permission request failed:",
      error,
    );

    return false;
  }
}

/**
 * Check whether notification permission is enabled.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();

    return settings.authorizationStatus >= 1;
  } catch (error) {
    console.error(
      "[NotificationScheduler] Could not check notification permission:",
      error,
    );

    return false;
  }
}

/**
 * Check whether Android exact alarm scheduling is available.
 */
export async function hasExactAlarmPermission(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();

    return (
      settings.android?.alarm ===
      AndroidNotificationSetting.ENABLED
    );
  } catch (error) {
    console.warn(
      "[NotificationScheduler] Could not check exact alarm permission:",
      error,
    );

    // Do not claim exact alarm scheduling is available
    // if the system could not confirm it.
    return false;
  }
}

/**
 * Open Android's exact alarm permission settings.
 */
export async function openExactAlarmSettings(): Promise<void> {
  try {
    await notifee.openAlarmPermissionSettings();
  } catch (error) {
    console.error(
      "[NotificationScheduler] Could not open alarm settings:",
      error,
    );

    throw error;
  }
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Parse HH:mm into a local Date object for today.
 */
function createTodayAtTime(time: string): Date {
  if (!isValidTime(time)) {
    throw new Error(
      `[NotificationScheduler] Invalid time: ${time}`,
    );
  }

  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date;
}

/**
 * Get the next occurrence of a local time.
 *
 * If today's occurrence has already passed, schedule tomorrow.
 */
function getNextOccurrence(time: string): Date {
  const next = createTodayAtTime(time);

  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Format a time for notification text.
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Check if a scheduled time is inside quiet hours.
 */
function isQuietTime(
  preferences: NotificationPreferences,
  time: string,
): boolean {
  if (!preferences.quietHoursEnabled) {
    return false;
  }

  return isWithinQuietHours(
    time,
    preferences.quietHoursStart,
    preferences.quietHoursEnd,
  );
}

// ============================================================================
// NOTIFICATION CONTENT
// ============================================================================

function getReminderBody(
  reminder: ReminderPreference,
): string {
  switch (reminder.id) {
    case "water":
      return "Take a moment to drink some water and stay hydrated.";

    case "morning":
      return "Step outside for some natural daylight and fresh air.";

    case "walk":
      return "Take a short walk and give your body a break.";

    case "stretch":
      return "Relax your muscles with a few gentle stretches.";

    case "exercise":
      return "It's time to move! Start a workout that feels right for you.";

    case "relax":
      return "Slow down with a breathing exercise or meditation.";

    default:
      return reminder.description;
  }
}

// ============================================================================
// BUILD SCHEDULE
// ============================================================================

/**
 * Build one daily notification for a fixed-time reminder.
 */
function buildFixedReminder(
  reminder: ReminderPreference,
  timestamp: number,
): ScheduledReminder {
  return {
    id: `${NOTIFICATION_ID_PREFIX}_${reminder.id}`,

    title: reminder.title,

    body: getReminderBody(reminder),

    reminderId: reminder.id,

    timestamp,
  };
}

/**
 * Build daily water reminder notifications.
 *
 * Example:
 * Start: 09:00
 * End: 19:00
 * Interval: 2 hours
 *
 * Result:
 * 09:00, 11:00, 13:00, 15:00, 17:00, 19:00
 *
 * Quiet-hour times are excluded.
 */
function buildWaterReminders(
  reminder: ReminderPreference,
  preferences: NotificationPreferences,
): ScheduledReminder[] {
  const intervalHours = reminder.intervalHours ?? 2;

  const startTime = reminder.startTime ?? "09:00";
  const endTime = reminder.endTime ?? "19:00";

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  const intervalMinutes = intervalHours * 60;

  const reminders: ScheduledReminder[] = [];

  for (
    let minutes = startMinutes;
    minutes <= endMinutes;
    minutes += intervalMinutes
  ) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    const time =
      `${String(hours).padStart(2, "0")}:` +
      `${String(remainingMinutes).padStart(2, "0")}`;

    if (isQuietTime(preferences, time)) {
      continue;
    }

    const nextOccurrence = getNextOccurrence(time);

    reminders.push({
      id: `${NOTIFICATION_ID_PREFIX}_water_${time.replace(":", "")}`,

      title: reminder.title,

      body: getReminderBody(reminder),

      reminderId: "water",

      timestamp: nextOccurrence.getTime(),
    });
  }

  return reminders;
}

/**
 * Build the complete notification schedule.
 */
function buildSchedule(
  preferences: NotificationPreferences,
): {
  reminders: ScheduledReminder[];
  skipped: number;
} {
  const reminders: ScheduledReminder[] = [];

  let skipped = 0;

  for (const reminderId of Object.keys(
    preferences.reminders,
  ) as ReminderId[]) {
    const reminder = preferences.reminders[reminderId];

    if (!reminder.enabled) {
      continue;
    }

    if (reminderId === "water") {
      const waterReminders = buildWaterReminders(
        reminder,
        preferences,
      );

      reminders.push(...waterReminders);

      continue;
    }

    if (isQuietTime(preferences, reminder.time)) {
      skipped++;
      continue;
    }

    const nextOccurrence = getNextOccurrence(
      reminder.time,
    );

    reminders.push(
      buildFixedReminder(
        reminder,
        nextOccurrence.getTime(),
      ),
    );
  }

  return {
    reminders,
    skipped,
  };
}

// ============================================================================
// CANCEL EXISTING WELLNESS REMINDERS
// ============================================================================

/**
 * Cancel only notifications created by this scheduler.
 *
 * Other app notifications are not affected.
 */
export async function cancelWellnessReminders(): Promise<number> {
  try {
    const ids = await notifee.getTriggerNotificationIds();

    const wellnessIds = ids.filter((id) =>
      id.startsWith(`${NOTIFICATION_ID_PREFIX}_`),
    );

    for (const id of wellnessIds) {
      await notifee.cancelNotification(id);
    }

    console.log(
      `[NotificationScheduler] Cancelled ${wellnessIds.length} scheduled reminders.`,
    );

    return wellnessIds.length;
  } catch (error) {
    console.error(
      "[NotificationScheduler] Could not cancel reminders:",
      error,
    );

    throw error;
  }
}

// ============================================================================
// SCHEDULE ONE NOTIFICATION
// ============================================================================

async function scheduleOneReminder(
  reminder: ScheduledReminder,
): Promise<void> {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: reminder.timestamp,
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: true,
  };

  await notifee.createTriggerNotification(
    {
      id: reminder.id,

      title: reminder.title,

      body: reminder.body,

      data: {
        type: "wellness_reminder",
        reminderId: reminder.reminderId,
      },

      android: {
        channelId: WELLNESS_CHANNEL_ID,

        importance: AndroidImportance.HIGH,

        pressAction: {
          id: "default",
        },

        smallIcon: "ic_launcher",

        autoCancel: true,
      },
    },
    trigger,
  );
}

// ============================================================================
// MAIN SCHEDULER
// ============================================================================

/**
 * Rebuild all scheduled reminders for a user.
 *
 * Call this:
 * - When notification preferences change.
 * - When the user enables notifications.
 * - When the app starts after login.
 * - When the user returns from Android alarm settings.
 */
export async function scheduleWellnessReminders(
  userId: string,
): Promise<ScheduleResult> {
  if (!userId?.trim()) {
    throw new Error(
      "[NotificationScheduler] A valid user ID is required.",
    );
  }

  console.log(
    "[NotificationScheduler] Rebuilding wellness reminders...",
  );

  const preferences = getNotificationPreferences(userId);

  const cancelled = await cancelWellnessReminders();

  if (!preferences.enabled) {
    console.log(
      "[NotificationScheduler] Master notifications switch is disabled.",
    );

    return {
      scheduled: 0,
      cancelled,
      skipped: 0,
      permissionGranted: false,
      exactAlarmEnabled: false,
    };
  }

  const permissionGranted =
    await hasNotificationPermission();

  if (!permissionGranted) {
    console.warn(
      "[NotificationScheduler] Notification permission is not granted.",
    );

    return {
      scheduled: 0,
      cancelled,
      skipped: 0,
      permissionGranted: false,
      exactAlarmEnabled: false,
    };
  }

  const exactAlarmEnabled =
    await hasExactAlarmPermission();

  if (!exactAlarmEnabled) {
    console.warn(
      "[NotificationScheduler] Exact alarm permission is disabled. Reminders have not been scheduled.",
    );

    return {
      scheduled: 0,
      cancelled,
      skipped: 0,
      permissionGranted: true,
      exactAlarmEnabled: false,
    };
  }

  await createNotificationChannel();

  const result = buildSchedule(preferences);

  if (result.reminders.length > MAX_TIMESTAMP_TRIGGERS) {
    throw new Error(
      `[NotificationScheduler] Schedule contains too many triggers: ${result.reminders.length}. Maximum allowed by this app: ${MAX_TIMESTAMP_TRIGGERS}.`,
    );
  }

  let scheduled = 0;

  try {
    for (const reminder of result.reminders) {
      await scheduleOneReminder(reminder);
      scheduled++;
    }
  } catch (error) {
    // Avoid leaving a partially scheduled configuration.
    await cancelWellnessReminders();

    console.error(
      "[NotificationScheduler] Scheduling failed:",
      error,
    );

    throw error;
  }

  console.log(
    `[NotificationScheduler] Successfully scheduled ${scheduled} reminders.`,
  );

  return {
    scheduled,
    cancelled,
    skipped: result.skipped,
    permissionGranted: true,
    exactAlarmEnabled: true,
  };
}

// ============================================================================
// TEST NOTIFICATION
// ============================================================================

/**
 * Display an immediate test notification.
 */
export async function showTestNotification(): Promise<void> {
  const permissionGranted =
    await hasNotificationPermission();

  if (!permissionGranted) {
    throw new Error(
      "Notification permission has not been granted.",
    );
  }

  await createNotificationChannel();

  await notifee.displayNotification({
    id: "wellness_test_notification",

    title: "Wellness AI",

    body: "Your notifications are working! Keep taking care of yourself.",

    android: {
      channelId: WELLNESS_CHANNEL_ID,

      importance: AndroidImportance.HIGH,

      pressAction: {
        id: "default",
      },

      smallIcon: "ic_launcher",

      autoCancel: true,
    },
  });
}

// ============================================================================
// SNOOZE
// ============================================================================

/**
 * Schedule a one-time snoozed notification.
 *
 * Default: 10 minutes.
 */
export async function snoozeNotification(
  reminderId: ReminderId,
  minutes = 10,
): Promise<void> {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
    throw new Error(
      "Snooze duration must be between 1 and 120 minutes.",
    );
  }

  const permissionGranted =
    await hasNotificationPermission();

  if (!permissionGranted) {
    throw new Error(
      "Notification permission has not been granted.",
    );
  }

  await createNotificationChannel();

  const reminderTitles: Record<ReminderId, string> = {
    water: "Drink water",
    morning: "Morning daylight",
    walk: "Take a walk",
    stretch: "Stretch break",
    exercise: "Exercise reminder",
    relax: "Relaxation time",
  };

  const timestamp = Date.now() + minutes * 60 * 1000;

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp,
    alarmManager: true,
  };

  await notifee.createTriggerNotification(
    {
      id: `wellness_snooze_${reminderId}`,

      title: reminderTitles[reminderId],

      body: "Here's your wellness reminder. Take a moment for yourself.",

      data: {
        type: "wellness_snooze",
        reminderId,
      },

      android: {
        channelId: WELLNESS_CHANNEL_ID,

        importance: AndroidImportance.HIGH,

        pressAction: {
          id: "default",
        },

        smallIcon: "ic_launcher",

        autoCancel: true,
      },
    },
    trigger,
  );
}

// ============================================================================
// SCHEDULE STATUS
// ============================================================================

/**
 * Get the number of scheduled wellness reminders.
 */
export async function getScheduledWellnessReminderCount(): Promise<number> {
  const ids = await notifee.getTriggerNotificationIds();

  return ids.filter((id) =>
    id.startsWith(`${NOTIFICATION_ID_PREFIX}_`),
  ).length;
}

/**
 * Cancel all wellness notifications, including pending snoozes.
 */
export async function cancelAllWellnessNotifications(): Promise<void> {
  await cancelWellnessReminders();

  const ids = await notifee.getTriggerNotificationIds();

  const snoozeIds = ids.filter((id) =>
    id.startsWith("wellness_snooze_"),
  );

  for (const id of snoozeIds) {
    await notifee.cancelNotification(id);
  }

  await notifee.cancelNotification(
    "wellness_test_notification",
  );
}
