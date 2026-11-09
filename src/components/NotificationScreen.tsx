// src/components/NotificationScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { User } from "@supabase/supabase-js";

import {
  NotificationPreferences,
  ReminderId,
  getNotificationPreferences,
  updateNotificationPreferences,
  updateReminderPreference,
  resetNotificationPreferences,
  isValidTime,
  formatReminderInterval,
} from "../services/notificationPreferences";

import {
  cancelAllWellnessNotifications,
  createNotificationChannel,
  hasExactAlarmPermission,
  hasNotificationPermission,
  openExactAlarmSettings,
  requestNotificationPermission,
  scheduleWellnessReminders,
  showTestNotification,
} from "../services/notificationScheduler";

// ============================================================================
// TYPES
// ============================================================================

type NotificationScreenProps = {
  user: User;
  onClose: () => void;
};

type ReminderConfig = {
  id: ReminderId;
  icon: string;
  color: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const GREEN = "#247A4A";
const DARK_GREEN = "#155C36";
const BACKGROUND = "#F4F8F5";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_DARK = "#20342A";
const TEXT_MUTED = "#77877D";
const BORDER = "#E6EEE8";

const REMINDER_CONFIG: ReminderConfig[] = [
  { id: "water", icon: "💧", color: "#3B9DD9" },
  { id: "morning", icon: "☀️", color: "#E7A83E" },
  { id: "walk", icon: "🚶", color: "#4C9B75" },
  { id: "stretch", icon: "🧘", color: "#8A78C7" },
  { id: "exercise", icon: "🏃", color: "#E58B54" },
  { id: "relax", icon: "🌿", color: "#4B9A89" },
];

// ============================================================================
// COMPONENT
// ============================================================================

const NotificationScreen: React.FC<NotificationScreenProps> = ({
  user,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [exactAlarmEnabled, setExactAlarmEnabled] = useState(false);
  const [permissionChecking, setPermissionChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // LOAD PREFERENCES
  // --------------------------------------------------------------------------

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const savedPreferences = getNotificationPreferences(user.id);

      setPreferences(savedPreferences);

      const [permission, exactAlarm] = await Promise.all([
        hasNotificationPermission(),
        hasExactAlarmPermission(),
      ]);

      setPermissionGranted(permission);
      setExactAlarmEnabled(exactAlarm);
    } catch (error) {
      console.error("[NotificationScreen] Loading failed:", error);

      setErrorMessage(
        "Unable to load notification settings. Please check your local database.",
      );
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  // --------------------------------------------------------------------------
  // REFRESH PERMISSIONS
  // --------------------------------------------------------------------------

  const refreshPermissions = useCallback(async () => {
    try {
      setPermissionChecking(true);

      const [permission, exactAlarm] = await Promise.all([
        hasNotificationPermission(),
        hasExactAlarmPermission(),
      ]);

      setPermissionGranted(permission);
      setExactAlarmEnabled(exactAlarm);
    } catch (error) {
      console.error(
        "[NotificationScreen] Permission refresh failed:",
        error,
      );
    } finally {
      setPermissionChecking(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // SCHEDULE NOTIFICATIONS
  // --------------------------------------------------------------------------

  const rebuildSchedule = useCallback(
    async (updatedPreferences: NotificationPreferences) => {
      if (!updatedPreferences.enabled) {
        await cancelAllWellnessNotifications();
        return;
      }

      const permission = await hasNotificationPermission();

      setPermissionGranted(permission);

      if (!permission) {
        return;
      }

      const result = await scheduleWellnessReminders(user.id);

      setExactAlarmEnabled(result.exactAlarmEnabled);

      console.log("[NotificationScreen] Schedule result:", result);

      if (result.scheduled === 0 && !result.exactAlarmEnabled) {
        Alert.alert(
          "Exact alarm permission required",
          "Android has not enabled exact alarm scheduling. Open the alarm settings and allow Wellness AI to schedule reminders.",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Open settings",
              onPress: () => {
                openExactAlarmSettings().catch(console.error);
              },
            },
          ],
        );
      }
    },
    [user.id],
  );

  // --------------------------------------------------------------------------
  // SAVE MASTER SETTINGS
  // --------------------------------------------------------------------------

  const saveGeneralSettings = useCallback(
    async (
      updates: Partial<
        Pick<
          NotificationPreferences,
          | "enabled"
          | "quietHoursEnabled"
          | "quietHoursStart"
          | "quietHoursEnd"
        >
      >,
    ) => {
      if (!preferences) return;

      try {
        setSaving(true);

        const updated = updateNotificationPreferences(user.id, updates);

        setPreferences(updated);

        await rebuildSchedule(updated);
      } catch (error) {
        console.error(
          "[NotificationScreen] Could not save settings:",
          error,
        );

        Alert.alert(
          "Unable to save",
          error instanceof Error
            ? error.message
            : "Something went wrong while saving your settings.",
        );

        await loadSettings();
      } finally {
        setSaving(false);
      }
    },
    [preferences, user.id, rebuildSchedule, loadSettings],
  );

  // --------------------------------------------------------------------------
  // MASTER SWITCH
  // --------------------------------------------------------------------------

  const handleMasterSwitch = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await requestNotificationPermission();

        setPermissionGranted(granted);

        if (!granted) {
          Alert.alert(
            "Notifications are disabled",
            "Please allow notifications for Wellness AI in Android settings before enabling reminders.",
          );

          return;
        }

        await createNotificationChannel();
      }

      await saveGeneralSettings({ enabled });
    },
    [saveGeneralSettings],
  );

  // --------------------------------------------------------------------------
  // INDIVIDUAL REMINDERS
  // --------------------------------------------------------------------------

  const handleReminderSwitch = useCallback(
    async (reminderId: ReminderId, enabled: boolean) => {
      if (!preferences) return;

      if (enabled && !preferences.enabled) {
        Alert.alert(
          "Enable notifications first",
          "Turn on the main notifications switch before enabling individual reminders.",
        );

        return;
      }

      if (enabled && !permissionGranted) {
        const granted = await requestNotificationPermission();

        setPermissionGranted(granted);

        if (!granted) return;
      }

      try {
        setSaving(true);

        const updated = updateReminderPreference(
          user.id,
          reminderId,
          { enabled },
        );

        setPreferences(updated);

        await rebuildSchedule(updated);
      } catch (error) {
        console.error(
          "[NotificationScreen] Reminder update failed:",
          error,
        );

        Alert.alert(
          "Reminder update failed",
          error instanceof Error
            ? error.message
            : "Unable to update this reminder.",
        );

        await loadSettings();
      } finally {
        setSaving(false);
      }
    },
    [preferences, permissionGranted, user.id, rebuildSchedule, loadSettings],
  );

  // --------------------------------------------------------------------------
  // REMINDER TIME
  // --------------------------------------------------------------------------

  const handleReminderTime = useCallback(
    async (reminderId: ReminderId, time: string) => {
      if (!isValidTime(time)) {
        Alert.alert(
          "Invalid time",
          "Enter a valid 24-hour time, for example 09:30 or 17:00.",
        );

        return;
      }

      try {
        setSaving(true);

        const updated = updateReminderPreference(
          user.id,
          reminderId,
          { time },
        );

        setPreferences(updated);

        await rebuildSchedule(updated);
      } catch (error) {
        console.error(
          "[NotificationScreen] Time update failed:",
          error,
        );

        Alert.alert(
          "Unable to update time",
          error instanceof Error
            ? error.message
            : "Please try again.",
        );

        await loadSettings();
      } finally {
        setSaving(false);
      }
    },
    [user.id, rebuildSchedule, loadSettings],
  );

  // --------------------------------------------------------------------------
  // WATER INTERVAL
  // --------------------------------------------------------------------------

  const handleWaterInterval = useCallback(
    async (intervalHours: number) => {
      try {
        setSaving(true);

        const updated = updateReminderPreference(
          user.id,
          "water",
          { intervalHours },
        );

        setPreferences(updated);

        await rebuildSchedule(updated);
      } catch (error) {
        console.error(
          "[NotificationScreen] Water interval update failed:",
          error,
        );

        Alert.alert(
          "Unable to update interval",
          error instanceof Error
            ? error.message
            : "Please try again.",
        );

        await loadSettings();
      } finally {
        setSaving(false);
      }
    },
    [user.id, rebuildSchedule, loadSettings],
  );

  // --------------------------------------------------------------------------
  // QUIET HOURS
  // --------------------------------------------------------------------------

  const handleQuietHoursTime = useCallback(
    async (
      field: "quietHoursStart" | "quietHoursEnd",
      time: string,
    ) => {
      if (!isValidTime(time)) {
        Alert.alert(
          "Invalid time",
          "Use 24-hour time format, for example 22:00.",
        );

        return;
      }

      await saveGeneralSettings({ [field]: time });
    },
    [saveGeneralSettings],
  );

  // --------------------------------------------------------------------------
  // TEST NOTIFICATION
  // --------------------------------------------------------------------------

  const handleTestNotification = useCallback(async () => {
    try {
      setTesting(true);

      let granted = await hasNotificationPermission();

      if (!granted) {
        granted = await requestNotificationPermission();
      }

      setPermissionGranted(granted);

      if (!granted) {
        Alert.alert(
          "Permission required",
          "Allow notifications for Wellness AI before sending a test.",
        );

        return;
      }

      await createNotificationChannel();
      await showTestNotification();

      Alert.alert(
        "Test notification sent",
        "Check your notification panel to see whether it appeared.",
      );
    } catch (error) {
      console.error(
        "[NotificationScreen] Test notification failed:",
        error,
      );

      Alert.alert(
        "Test failed",
        error instanceof Error
          ? error.message
          : "Unable to display a test notification.",
      );
    } finally {
      setTesting(false);
    }
  }, []);

  // --------------------------------------------------------------------------
  // RESET
  // --------------------------------------------------------------------------

  const handleReset = useCallback(() => {
    Alert.alert(
      "Reset notification settings?",
      "This will restore all reminders and quiet-hour settings to their defaults.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);

              const updated = resetNotificationPreferences(user.id);

              setPreferences(updated);

              await rebuildSchedule(updated);

              Alert.alert(
                "Settings restored",
                "Your default notification preferences have been restored.",
              );
            } catch (error) {
              console.error(
                "[NotificationScreen] Reset failed:",
                error,
              );

              Alert.alert(
                "Reset failed",
                "Unable to restore your settings.",
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [user.id, rebuildSchedule]);

  // --------------------------------------------------------------------------
  // REMINDER LOOKUP
  // --------------------------------------------------------------------------

  const enabledReminderCount = useMemo(() => {
    if (!preferences) return 0;

    return Object.values(preferences.reminders).filter(
      (reminder) => reminder.enabled,
    ).length;
  }, [preferences]);

  // --------------------------------------------------------------------------
  // LOADING
  // --------------------------------------------------------------------------

  if (loading || !preferences) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { paddingTop: insets.top },
        ]}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent={true}
        />

        {errorMessage ? (
          <>
            <Text style={styles.errorText}>{errorMessage}</Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadSettings}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loadingBackButton}
              onPress={onClose}
            >
              <Text style={styles.loadingBackButtonText}>
                Go back
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={GREEN} />

            <Text style={styles.loadingText}>
              Loading notification settings...
            </Text>
          </>
        )}
      </View>
    );
  }

  // ==========================================================================
  // MAIN UI
  // ==========================================================================

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* ENTIRE SCREEN NOW SCROLLS, INCLUDING THE HEADER */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Safe space for status bar without extra top padding.
            paddingTop: insets.top,

            // Keep content clear of bottom navigation.
            paddingBottom: Math.max(insets.bottom, 12) + 105,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Go back to profile"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>

            <Text style={styles.headerSubtitle}>
              Build healthy habits, one reminder at a time.
            </Text>
          </View>

          {saving && (
            <ActivityIndicator size="small" color={GREEN} />
          )}
        </View>

        {/* INTRO CARD */}

        <LinearGradient
          colors={["#E1F4E7", "#D3EEDF", "#EAF6ED"]}
          style={styles.heroCard}
        >
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🔔</Text>
          </View>

          <Text style={styles.heroTitle}>
            Your wellness routine
          </Text>

          <Text style={styles.heroDescription}>
            Let Wellness AI gently remind you to drink water,
            move, exercise and take time to relax.
          </Text>

          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroStatNumber}>
                {enabledReminderCount}
              </Text>

              <Text style={styles.heroStatLabel}>
                Active reminders
              </Text>
            </View>

            <View style={styles.heroStatDivider} />

            <View>
              <Text style={styles.heroStatNumber}>
                {preferences.quietHoursEnabled ? "On" : "Off"}
              </Text>

              <Text style={styles.heroStatLabel}>
                Quiet hours
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* MASTER NOTIFICATION SWITCH */}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.masterIcon}>
              <Text style={styles.masterEmoji}>🔔</Text>
            </View>

            <View style={styles.flexContent}>
              <Text style={styles.cardTitle}>
                Allow notifications
              </Text>

              <Text style={styles.cardDescription}>
                Turn all wellness reminders on or off.
              </Text>
            </View>

            <Switch
              value={preferences.enabled}
              disabled={saving}
              onValueChange={handleMasterSwitch}
              trackColor={{
                false: "#D5DDD7",
                true: "#A5D8B5",
              }}
              thumbColor={preferences.enabled ? GREEN : "#F4F4F4"}
            />
          </View>

          {!permissionGranted && (
            <TouchableOpacity
              style={styles.permissionWarning}
              disabled={saving}
              onPress={async () => {
                const granted = await requestNotificationPermission();

                setPermissionGranted(granted);

                if (granted) {
                  Alert.alert(
                    "Permission granted",
                    "You can now receive Wellness AI notifications.",
                  );
                }
              }}
            >
              <Text style={styles.permissionWarningText}>
                ⚠ Notifications permission is not enabled.
                Tap here to request it.
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* REMINDER SETTINGS */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Daily reminders
          </Text>

          <Text style={styles.sectionSubtitle}>
            Choose which healthy habits you want to be reminded about.
          </Text>
        </View>

        {REMINDER_CONFIG.map((config) => {
          const reminder = preferences.reminders[config.id];

          return (
            <View key={config.id} style={styles.reminderCard}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.reminderIcon,
                    { backgroundColor: `${config.color}18` },
                  ]}
                >
                  <Text style={styles.reminderEmoji}>
                    {config.icon}
                  </Text>
                </View>

                <View style={styles.flexContent}>
                  <Text style={styles.reminderTitle}>
                    {reminder.title}
                  </Text>

                  <Text style={styles.reminderDescription}>
                    {reminder.description}
                  </Text>
                </View>

                <Switch
                  value={reminder.enabled}
                  disabled={!preferences.enabled || saving}
                  onValueChange={(value) =>
                    handleReminderSwitch(config.id, value)
                  }
                  trackColor={{
                    false: "#D5DDD7",
                    true: "#A5D8B5",
                  }}
                  thumbColor={reminder.enabled ? GREEN : "#F4F4F4"}
                />
              </View>

              {config.id === "water" ? (
                <View style={styles.reminderExtra}>
                  <Text style={styles.fieldLabel}>
                    Reminder interval
                  </Text>

                  <View style={styles.intervalContainer}>
                    {[1, 2, 3, 4].map((hours) => {
                      const selected =
                        reminder.intervalHours === hours;

                      return (
                        <TouchableOpacity
                          key={hours}
                          disabled={
                            !preferences.enabled ||
                            !reminder.enabled ||
                            saving
                          }
                          style={[
                            styles.intervalButton,
                            selected && styles.intervalButtonSelected,
                          ]}
                          onPress={() => handleWaterInterval(hours)}
                        >
                          <Text
                            style={[
                              styles.intervalText,
                              selected && styles.intervalTextSelected,
                            ]}
                          >
                            {hours}h
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>
                    Start and end time
                  </Text>

                  <View style={styles.timeRangeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeCaption}>Start</Text>

                      <TextInput
                        style={styles.timeInput}
                        value={reminder.startTime}
                        editable={
                          preferences.enabled &&
                          reminder.enabled &&
                          !saving
                        }
                        onChangeText={(value) => {
                          setPreferences((current) => {
                            if (!current) return current;

                            return {
                              ...current,
                              reminders: {
                                ...current.reminders,
                                water: {
                                  ...current.reminders.water,
                                  startTime: value,
                                },
                              },
                            };
                          });
                        }}
                        onEndEditing={(event) => {
                          const value =
                            event.nativeEvent.text.trim();

                          const current =
                            getNotificationPreferences(user.id);

                          const water = current.reminders.water;

                          if (
                            !isValidTime(value) ||
                            value >= (water.endTime ?? "19:00")
                          ) {
                            Alert.alert(
                              "Invalid water reminder time",
                              "The start time must be valid and earlier than the end time.",
                            );

                            setPreferences(current);
                            return;
                          }

                          updateReminderPreference(
                            user.id,
                            "water",
                            { startTime: value },
                          );

                          const updated =
                            getNotificationPreferences(user.id);

                          setPreferences(updated);

                          rebuildSchedule(updated).catch(console.error);
                        }}
                        placeholder="09:00"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                    </View>

                    <View style={styles.timeField}>
                      <Text style={styles.timeCaption}>End</Text>

                      <TextInput
                        style={styles.timeInput}
                        value={reminder.endTime}
                        editable={
                          preferences.enabled &&
                          reminder.enabled &&
                          !saving
                        }
                        onChangeText={(value) => {
                          setPreferences((current) => {
                            if (!current) return current;

                            return {
                              ...current,
                              reminders: {
                                ...current.reminders,
                                water: {
                                  ...current.reminders.water,
                                  endTime: value,
                                },
                              },
                            };
                          });
                        }}
                        onEndEditing={(event) => {
                          const value =
                            event.nativeEvent.text.trim();

                          const current =
                            getNotificationPreferences(user.id);

                          const water = current.reminders.water;

                          if (
                            !isValidTime(value) ||
                            value <= (water.startTime ?? "09:00")
                          ) {
                            Alert.alert(
                              "Invalid water reminder time",
                              "The end time must be valid and later than the start time.",
                            );

                            setPreferences(current);
                            return;
                          }

                          updateReminderPreference(
                            user.id,
                            "water",
                            { endTime: value },
                          );

                          const updated =
                            getNotificationPreferences(user.id);

                          setPreferences(updated);

                          rebuildSchedule(updated).catch(console.error);
                        }}
                        placeholder="19:00"
                        keyboardType="numbers-and-punctuation"
                        maxLength={5}
                      />
                    </View>
                  </View>

                  <Text style={styles.helperText}>
                    {formatReminderInterval(reminder.intervalHours ?? 2)}{" "}
                    between your selected hours.
                  </Text>
                </View>
              ) : (
                <View style={styles.reminderExtra}>
                  <Text style={styles.fieldLabel}>
                    Reminder time
                  </Text>

                  <TextInput
                    style={styles.timeInput}
                    value={reminder.time}
                    editable={
                      preferences.enabled &&
                      reminder.enabled &&
                      !saving
                    }
                    onChangeText={(value) => {
                      setPreferences((current) => {
                        if (!current) return current;

                        return {
                          ...current,
                          reminders: {
                            ...current.reminders,
                            [config.id]: {
                              ...current.reminders[config.id],
                              time: value,
                            },
                          },
                        };
                      });
                    }}
                    onEndEditing={(event) =>
                      handleReminderTime(
                        config.id,
                        event.nativeEvent.text.trim(),
                      )
                    }
                    placeholder="17:00"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              )}
            </View>
          );
        })}

        {/* QUIET HOURS */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quiet hours</Text>

          <Text style={styles.sectionSubtitle}>
            Choose when you would prefer not to receive reminders.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.quietIcon}>
              <Text style={styles.masterEmoji}>🌙</Text>
            </View>

            <View style={styles.flexContent}>
              <Text style={styles.cardTitle}>
                Enable quiet hours
              </Text>

              <Text style={styles.cardDescription}>
                Pause scheduled reminders during these hours.
              </Text>
            </View>

            <Switch
              value={preferences.quietHoursEnabled}
              disabled={!preferences.enabled || saving}
              onValueChange={(value) =>
                saveGeneralSettings({ quietHoursEnabled: value })
              }
              trackColor={{
                false: "#D5DDD7",
                true: "#A5D8B5",
              }}
              thumbColor={
                preferences.quietHoursEnabled ? GREEN : "#F4F4F4"
              }
            />
          </View>

          <View style={styles.timeRangeRow}>
            <View style={styles.timeField}>
              <Text style={styles.timeCaption}>
                Quiet hours start
              </Text>

              <TextInput
                style={styles.timeInput}
                value={preferences.quietHoursStart}
                editable={
                  preferences.enabled &&
                  preferences.quietHoursEnabled &&
                  !saving
                }
                onChangeText={(value) => {
                  setPreferences((current) =>
                    current
                      ? { ...current, quietHoursStart: value }
                      : current,
                  );
                }}
                onEndEditing={(event) =>
                  handleQuietHoursTime(
                    "quietHoursStart",
                    event.nativeEvent.text.trim(),
                  )
                }
                placeholder="22:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>

            <View style={styles.timeField}>
              <Text style={styles.timeCaption}>
                Quiet hours end
              </Text>

              <TextInput
                style={styles.timeInput}
                value={preferences.quietHoursEnd}
                editable={
                  preferences.enabled &&
                  preferences.quietHoursEnabled &&
                  !saving
                }
                onChangeText={(value) => {
                  setPreferences((current) =>
                    current
                      ? { ...current, quietHoursEnd: value }
                      : current,
                  );
                }}
                onEndEditing={(event) =>
                  handleQuietHoursTime(
                    "quietHoursEnd",
                    event.nativeEvent.text.trim(),
                  )
                }
                placeholder="07:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>

          <Text style={styles.helperText}>
            Example: 22:00 to 07:00 pauses notifications overnight.
          </Text>
        </View>

        {/* ANDROID PERMISSIONS */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Android permissions
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.permissionRow}>
            <View style={styles.flexContent}>
              <Text style={styles.permissionTitle}>
                Notification permission
              </Text>

              <Text style={styles.permissionDescription}>
                Allow Wellness AI to display notifications.
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                permissionGranted
                  ? styles.statusEnabled
                  : styles.statusDisabled,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  permissionGranted
                    ? styles.statusEnabledText
                    : styles.statusDisabledText,
                ]}
              >
                {permissionGranted ? "Granted" : "Not granted"}
              </Text>
            </View>
          </View>

          <View style={styles.permissionDivider} />

          <View style={styles.permissionRow}>
            <View style={styles.flexContent}>
              <Text style={styles.permissionTitle}>
                Exact alarm permission
              </Text>

              <Text style={styles.permissionDescription}>
                Allows scheduled reminders to use Android exact alarms.
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                exactAlarmEnabled
                  ? styles.statusEnabled
                  : styles.statusDisabled,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  exactAlarmEnabled
                    ? styles.statusEnabledText
                    : styles.statusDisabledText,
                ]}
              >
                {exactAlarmEnabled ? "Enabled" : "Not enabled"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.outlineButton}
            disabled={permissionChecking}
            onPress={async () => {
              try {
                await openExactAlarmSettings();
              } catch {
                Alert.alert(
                  "Unable to open settings",
                  "Please open your Android app settings and check the alarm permissions manually.",
                );
              }
            }}
          >
            <Text style={styles.outlineButtonText}>
              Open exact alarm settings
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshPermissions}
            disabled={permissionChecking}
          >
            {permissionChecking ? (
              <ActivityIndicator size="small" color={GREEN} />
            ) : (
              <Text style={styles.refreshButtonText}>
                Refresh permission status
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* TEST NOTIFICATION */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Test your notifications
          </Text>

          <Text style={styles.cardDescription}>
            Send a notification immediately to check that your device can display it.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleTestNotification}
            disabled={testing}
            activeOpacity={0.85}
          >
            {testing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Send test notification
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* RESET */}

        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleReset}
          disabled={saving}
        >
          <Text style={styles.resetButtonText}>
            Reset notification preferences
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Wellness AI · Your wellness, your routine.
        </Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  scrollView: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingText: {
    color: TEXT_MUTED,
    fontSize: 14,
    marginTop: 14,
  },

  errorText: {
    color: "#B42318",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
  },

  retryButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  loadingBackButton: {
    alignItems: "center",
    padding: 12,
  },

  loadingBackButtonText: {
    color: GREEN,
    fontWeight: "700",
  },

  // HEADER

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 16,
    backgroundColor: BACKGROUND,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E6F2E9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  backArrow: {
    color: DARK_GREEN,
    fontSize: 32,
    lineHeight: 36,
    marginTop: -4,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    color: TEXT_DARK,
    fontSize: 22,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 3,
  },

  scrollContent: {
    paddingHorizontal: 18,
  },

  // HERO

  heroCard: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
  },

  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  heroEmoji: {
    fontSize: 25,
  },

  heroTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: DARK_GREEN,
  },

  heroDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#587462",
    marginTop: 7,
  },

  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },

  heroStatNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK_GREEN,
  },

  heroStatLabel: {
    fontSize: 11,
    color: "#587462",
    marginTop: 3,
  },

  heroStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: "#BBD9C5",
    marginHorizontal: 26,
  },

  // CARDS

  card: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 18,
    padding: 17,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  flexContent: {
    flex: 1,
    minWidth: 0,
  },

  masterIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E8F5EC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  masterEmoji: {
    fontSize: 22,
  },

  cardTitle: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: "800",
  },

  cardDescription: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  permissionWarning: {
    backgroundColor: "#FFF6E7",
    borderRadius: 10,
    padding: 11,
    marginTop: 15,
  },

  permissionWarningText: {
    color: "#95651A",
    fontSize: 12,
    lineHeight: 18,
  },

  // SECTION HEADERS

  sectionHeader: {
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  sectionTitle: {
    color: TEXT_DARK,
    fontSize: 17,
    fontWeight: "800",
  },

  sectionSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  // REMINDERS

  reminderCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },

  reminderIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  reminderEmoji: {
    fontSize: 21,
  },

  reminderTitle: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: "800",
  },

  reminderDescription: {
    color: TEXT_MUTED,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
    paddingRight: 4,
  },

  reminderExtra: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2EF",
    marginTop: 15,
    paddingTop: 14,
  },

  fieldLabel: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 9,
  },

  intervalContainer: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 17,
  },

  intervalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#F1F5F2",
    borderWidth: 1,
    borderColor: BORDER,
  },

  intervalButtonSelected: {
    backgroundColor: "#E2F2E7",
    borderColor: GREEN,
  },

  intervalText: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: "700",
  },

  intervalTextSelected: {
    color: DARK_GREEN,
  },

  timeRangeRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 13,
  },

  timeField: {
    flex: 1,
    minWidth: 0,
  },

  timeCaption: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginBottom: 6,
  },

  timeInput: {
    minWidth: 0,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F8FAF8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: "700",
  },

  helperText: {
    color: TEXT_MUTED,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
  },

  // QUIET HOURS

  quietIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F0ECFA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  // PERMISSIONS

  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  permissionTitle: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: "700",
  },

  permissionDescription: {
    color: TEXT_MUTED,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },

  statusEnabled: {
    backgroundColor: "#E4F5E9",
  },

  statusDisabled: {
    backgroundColor: "#FFF0E8",
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  statusEnabledText: {
    color: GREEN,
  },

  statusDisabledText: {
    color: "#B45B35",
  },

  permissionDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 15,
  },

  outlineButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GREEN,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 18,
  },

  outlineButtonText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: "800",
  },

  refreshButton: {
    alignItems: "center",
    paddingVertical: 12,
  },

  refreshButtonText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: "700",
  },

  // TEST

  primaryButton: {
    backgroundColor: GREEN,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 17,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  // RESET

  resetButton: {
    alignItems: "center",
    paddingVertical: 17,
    marginTop: 4,
  },

  resetButtonText: {
    color: "#B44C42",
    fontSize: 12,
    fontWeight: "700",
  },

  footerText: {
    color: "#9AA79E",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});

export default NotificationScreen;
