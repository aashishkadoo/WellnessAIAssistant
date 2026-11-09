//src/services/notificationHandlers.ts
import notifee, {
  Event,
  EventType,
  Notification,
} from "@notifee/react-native";

import {
  ReminderId,
} from "./notificationPreferences";

import {
  snoozeNotification,
} from "./notificationScheduler";

// ============================================================================
// TYPES
// ============================================================================

export type WellnessNotificationData = {
  type?: string;
  reminderId?: string;
};

export type NotificationHandlerCallbacks = {
  onNotificationOpened?: (
    notification: Notification,
  ) => void;

  onNotificationDismissed?: (
    notification: Notification,
  ) => void;

  onNotificationDelivered?: (
    notification: Notification,
  ) => void;

  onSnoozeScheduled?: (
    reminderId: ReminderId,
  ) => void;

  onError?: (error: unknown) => void;
};

// ============================================================================
// HELPERS
// ============================================================================

const VALID_REMINDER_IDS: ReminderId[] = [
  "water",
  "morning",
  "walk",
  "stretch",
  "exercise",
  "relax",
];

/**
 * Safely extract the reminder ID from notification data.
 */
function getReminderId(
  notification: Notification | undefined,
): ReminderId | null {
  const data = notification?.data as
    | WellnessNotificationData
    | undefined;

  const reminderId = data?.reminderId;

  if (
    !reminderId ||
    !VALID_REMINDER_IDS.includes(
      reminderId as ReminderId,
    )
  ) {
    return null;
  }

  return reminderId as ReminderId;
}

/**
 * Report errors without crashing the application.
 */
function reportError(
  error: unknown,
  callbacks?: NotificationHandlerCallbacks,
): void {
  console.error(
    "[NotificationHandlers] Error:",
    error,
  );

  callbacks?.onError?.(error);
}

// ============================================================================
// EVENT PROCESSING
// ============================================================================

/**
 * Process a notification event.
 *
 * This function can be used by both foreground and
 * background event handlers.
 */
export async function handleNotificationEvent(
  event: Event,
  callbacks?: NotificationHandlerCallbacks,
): Promise<void> {
  const { type, detail } = event;

  const notification = detail.notification;

  if (!notification) {
    return;
  }

  try {
    switch (type) {
      // ----------------------------------------------------
      // Notification opened
      // ----------------------------------------------------

      case EventType.PRESS: {
        console.log(
          "[NotificationHandlers] Notification opened:",
          notification.id,
        );

        callbacks?.onNotificationOpened?.(
          notification,
        );

        break;
      }

      // ----------------------------------------------------
      // Notification action pressed
      // ----------------------------------------------------

      case EventType.ACTION_PRESS: {
        const actionId = detail.pressAction?.id;

        const reminderId = getReminderId(
          notification,
        );

        if (
          actionId === "snooze" &&
          reminderId
        ) {
          await snoozeNotification(
            reminderId,
            10,
          );

          callbacks?.onSnoozeScheduled?.(
            reminderId,
          );

          console.log(
            `[NotificationHandlers] ${reminderId} reminder snoozed for 10 minutes.`,
          );

          break;
        }

        if (actionId === "default") {
          callbacks?.onNotificationOpened?.(
            notification,
          );
        }

        break;
      }

      // ----------------------------------------------------
      // Notification delivered
      // ----------------------------------------------------

      case EventType.DELIVERED: {
        console.log(
          "[NotificationHandlers] Notification delivered:",
          notification.id,
        );

        callbacks?.onNotificationDelivered?.(
          notification,
        );

        break;
      }

      // ----------------------------------------------------
      // Notification dismissed
      // ----------------------------------------------------

      case EventType.DISMISSED: {
        console.log(
          "[NotificationHandlers] Notification dismissed:",
          notification.id,
        );

        callbacks?.onNotificationDismissed?.(
          notification,
        );

        break;
      }

      default:
        break;
    }
  } catch (error) {
    reportError(error, callbacks);
  }
}

// ============================================================================
// BACKGROUND HANDLER
// ============================================================================

/**
 * Register this handler ONCE in index.js.
 *
 * Do not register this inside App.tsx or a React component.
 */
export async function handleBackgroundNotificationEvent(
  event: Event,
): Promise<void> {
  console.log(
    "[NotificationHandlers] Background notification event:",
    event.type,
  );

  await handleNotificationEvent(event);
}

// ============================================================================
// FOREGROUND HANDLER
// ============================================================================

/**
 * Listen for notification events while the app is open.
 *
 * Call this inside a React useEffect.
 *
 * Example:
 *
 * useEffect(() => {
 *   return registerForegroundNotificationHandler({
 *     onNotificationOpened: notification => {
 *       console.log(notification);
 *     },
 *   });
 * }, []);
 */
export function registerForegroundNotificationHandler(
  callbacks?: NotificationHandlerCallbacks,
): () => void {
  const unsubscribe = notifee.onForegroundEvent(
    async (event) => {
      await handleNotificationEvent(
        event,
        callbacks,
      );
    },
  );

  console.log(
    "[NotificationHandlers] Foreground listener registered.",
  );

  return () => {
    unsubscribe();

    console.log(
      "[NotificationHandlers] Foreground listener removed.",
    );
  };
}

// ============================================================================
// INITIAL NOTIFICATION
// ============================================================================

/**
 * Check whether the app was opened by tapping a notification.
 *
 * Call once after the authenticated application is ready.
 */
export async function handleInitialNotification(
  callbacks?: NotificationHandlerCallbacks,
): Promise<Notification | null> {
  try {
    const initialNotification =
      await notifee.getInitialNotification();

    if (!initialNotification) {
      return null;
    }

    console.log(
      "[NotificationHandlers] App opened from notification:",
      initialNotification.notification.id,
    );

    callbacks?.onNotificationOpened?.(
      initialNotification.notification,
    );

    return initialNotification.notification;
  } catch (error) {
    reportError(error, callbacks);

    return null;
  }
}

// ============================================================================
// PUBLIC UTILITIES
// ============================================================================

/**
 * Check whether a notification belongs to Wellness AI.
 */
export function isWellnessNotification(
  notification: Notification,
): boolean {
  const data = notification.data as
    | WellnessNotificationData
    | undefined;

  return (
    data?.type === "wellness_reminder" ||
    data?.type === "wellness_snooze"
  );
}

/**
 * Extract a readable notification title.
 */
export function getNotificationTitle(
  notification: Notification,
): string {
  return (
    notification.title ||
    "Wellness AI"
  );
}

/**
 * Extract a readable notification message.
 */
export function getNotificationBody(
  notification: Notification,
): string {
  return (
    notification.body ||
    "Take a moment to look after yourself."
  );
}
