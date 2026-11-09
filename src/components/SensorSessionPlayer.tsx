// src/components/SensorSessionPlayer.tsx

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Animated,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import {
  ArrowLeft,
  Activity,
  Check,
  Clock3,
  Dumbbell,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react-native";
import {
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from "react-native-sensors";
import { map } from "rxjs/operators";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type Props = {
  user: any;
  exercise: {
    id: string;
    title: string;
    category: string;
    type: string;
    sensor: string | null;
  };
  onClose: (completed: boolean) => void;
};

type SessionStatus = "loading" | "ready" | "denied" | "error";

async function ensureSensorPermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    return true;
  }

  if (Number(Platform.Version) < 29) {
    return true;
  }

  try {
    const permission =
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION;

    const alreadyGranted = await PermissionsAndroid.check(permission);

    if (alreadyGranted) {
      return true;
    }

    const result = await PermissionsAndroid.request(permission, {
      title: "Motion access",
      message:
        "Wellness AI uses your phone's motion sensor to estimate repetitions during this exercise.",
      buttonPositive: "Allow",
      buttonNegative: "Not now",
      buttonNeutral: "Ask me later",
    });

    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn("[SensorSessionPlayer] Permission error:", error);
    return false;
  }
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export default function SensorSessionPlayer({
  user,
  exercise,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const repsRef = useRef(0);
  const lastPeakRef = useRef(0);
  const smoothRef = useRef(1);
  const lastMagnitudeRef = useRef(1);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(
    null
  );

  const pulse = useRef(new Animated.Value(1)).current;

  // Prepare permission and create a session record.
  useEffect(() => {
    mountedRef.current = true;

    let cancelled = false;

    async function prepareSession() {
      if (!user?.id) {
        if (!cancelled) {
          setStatus("error");
        }
        return;
      }

      const permitted = await ensureSensorPermission();

      if (cancelled || !mountedRef.current) {
        return;
      }

      if (!permitted) {
        setStatus("denied");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("wellness_sessions")
          .insert({
            user_id: user.id,
            exercise_id: exercise.id,
            session_type: exercise.type,
            category: exercise.category,
            completed: false,
            duration_seconds: 0,
            started_at: new Date().toISOString(),
            metadata: {
              source: "sensor_player",
              sensor: exercise.sensor,
              exercise_title: exercise.title,
              reps: 0,
            },
          })
          .select("id")
          .single();

        if (cancelled || !mountedRef.current) {
          return;
        }

        if (error || !data?.id) {
          console.warn(
            "[SensorSessionPlayer] Session creation failed:",
            error?.message
          );
          setStatus("error");
          return;
        }

        sessionIdRef.current = data.id;
        setSessionId(data.id);
        setStatus("ready");
        setRunning(true);
      } catch (error) {
        console.warn(
          "[SensorSessionPlayer] Preparation failed:",
          error
        );

        if (!cancelled && mountedRef.current) {
          setStatus("error");
        }
      }
    }

    void prepareSession();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [
    user?.id,
    exercise.id,
    exercise.type,
    exercise.category,
    exercise.sensor,
    exercise.title,
  ]);

  // Run the timer only while the exercise is active.
  useEffect(() => {
    if (!running || status !== "ready" || saving) {
      return;
    }

    const startedAt = Date.now();

    const timer = setInterval(() => {
      const seconds = Math.floor(
        (Date.now() - startedAt) / 1000
      );

      // The timer is resumed from the previous elapsed value.
      elapsedRef.current += seconds > 0 ? 1 : 0;

      if (mountedRef.current) {
        setElapsed((previous) => {
          const next = previous + 1;
          elapsedRef.current = next;
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [running, status, saving]);

  // Subscribe only while actively exercising.
  useEffect(() => {
    if (status !== "ready" || !running || saving) {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      return;
    }

    try {
      setUpdateIntervalForType(SensorTypes.accelerometer, 80);

      const subscription = accelerometer
        .pipe(
          map(({ x, y, z }) => {
            const rawMagnitude = Math.sqrt(
              x * x + y * y + z * z
            );

            const alpha = 0.3;

            smoothRef.current =
              alpha * rawMagnitude +
              (1 - alpha) * smoothRef.current;

            return smoothRef.current;
          })
        )
        .subscribe({
          next: (magnitude) => {
            if (
              !mountedRef.current ||
              !running ||
              savingRef.current ||
              finishedRef.current
            ) {
              return;
            }

            const delta = Math.abs(
              magnitude - lastMagnitudeRef.current
            );

            const now = Date.now();
            const cooldownMs = 800;

            // Basic motion-based estimate, not exercise-specific pose recognition.
            if (
              delta > 0.45 &&
              now - lastPeakRef.current > cooldownMs
            ) {
              lastPeakRef.current = now;
              repsRef.current += 1;

              setReps(repsRef.current);

              Animated.sequence([
                Animated.timing(pulse, {
                  toValue: 1.045,
                  duration: 100,
                  useNativeDriver: true,
                }),
                Animated.spring(pulse, {
                  toValue: 1,
                  useNativeDriver: true,
                  speed: 22,
                  bounciness: 5,
                }),
              ]).start();
            }

            lastMagnitudeRef.current = magnitude;
          },
          error: (error) => {
            console.warn(
              "[SensorSessionPlayer] Sensor stream error:",
              error
            );

            if (mountedRef.current) {
              setRunning(false);
              Alert.alert(
                "Sensor unavailable",
                "The motion sensor stopped responding. You can try resuming the session."
              );
            }
          },
        });

      subscriptionRef.current = subscription;
    } catch (error) {
      console.warn(
        "[SensorSessionPlayer] Could not start sensor:",
        error
      );

      setRunning(false);

      Alert.alert(
        "Unable to start tracking",
        "Your device's motion sensor could not be started."
      );
    }

    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [status, running, saving, pulse]);

  const finish = useCallback(async () => {
    if (savingRef.current || finishedRef.current) {
      return;
    }

    if (!user?.id || !sessionIdRef.current) {
      Alert.alert(
        "Session unavailable",
        "Your session hasn't been saved to the server yet. Please try again."
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setRunning(false);

    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = null;

    try {
      const totalSeconds = Math.max(
        0,
        Math.floor(elapsedRef.current)
      );

      const totalReps = repsRef.current;

      const { error: sessionError } = await supabase
        .from("wellness_sessions")
        .update({
          completed: true,
          duration_seconds: totalSeconds,
          completed_at: new Date().toISOString(),
          metadata: {
            source: "sensor_player",
            sensor: exercise.sensor,
            exercise_title: exercise.title,
            reps: totalReps,
          },
        })
        .eq("id", sessionIdRef.current)
        .eq("user_id", user.id);

      if (sessionError) {
        throw sessionError;
      }

      const { error: activityError } = await supabase
        .from("daily_activities")
        .insert({
          user_id: user.id,
          activity_type: exercise.category || "Movement",
          duration_minutes: Math.max(
            1,
            Math.round(totalSeconds / 60)
          ),
          completed: true,
        });

      if (activityError) {
        // The session is saved, but activity logging failed.
        // Avoid retrying the whole finish flow and duplicating the session.
        console.warn(
          "[SensorSessionPlayer] Activity logging failed:",
          activityError.message
        );
      }

      finishedRef.current = true;

      if (mountedRef.current) {
        Alert.alert(
          "Session complete",
          `${totalReps} estimated reps in ${formatTime(totalSeconds)}.`,
          [
            {
              text: "Done",
              onPress: () => onClose(true),
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while saving your session.";

      Alert.alert("Unable to save session", message);
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [user?.id, exercise, onClose]);

  const cancel = useCallback(() => {
    Alert.alert(
      "Exit exercise?",
      "Your current progress will not be marked as completed.",
      [
        {
          text: "Keep going",
          style: "cancel",
        },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => {
            setRunning(false);
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
            onClose(false);
          },
        },
      ]
    );
  }, [onClose]);

  const toggleRunning = useCallback(() => {
    if (saving || status !== "ready" || finishedRef.current) {
      return;
    }

    setRunning((previous) => !previous);
  }, [saving, status]);

  const resetCounter = useCallback(() => {
    if (!running || saving) {
      Alert.alert(
        "Reset repetitions?",
        "This will reset the rep counter to zero.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reset",
            style: "destructive",
            onPress: () => {
              repsRef.current = 0;
              setReps(0);
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      "Reset repetitions?",
      "This will reset the rep counter to zero.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            repsRef.current = 0;
            setReps(0);
          },
        },
      ]
    );
  }, [running, saving]);

  const safeClose = () => {
    if (saving) {
      return;
    }

    cancel();
  };

  if (status === "loading") {
    return (
      <View
        style={[
          styles.root,
          styles.center,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <LinearGradient
          colors={["#E2F3E7", "#F4F8F5"]}
          style={styles.loadingIcon}
        >
          <Activity size={34} color="#247A4A" />
        </LinearGradient>

        <ActivityIndicator
          size="small"
          color="#247A4A"
          style={styles.loadingSpinner}
        />

        <Text style={styles.loadingTitle}>
          Preparing your session
        </Text>

        <Text style={styles.loadingText}>
          Connecting motion sensors and setting up your workout.
        </Text>
      </View>
    );
  }

  if (status === "denied") {
    return (
      <View
        style={[
          styles.root,
          styles.center,
          styles.statePadding,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.stateIcon}>
          <Smartphone size={34} color="#247A4A" />
        </View>

        <Text style={styles.stateTitle}>
          Motion access is needed
        </Text>

        <Text style={styles.stateDescription}>
          Allow activity recognition in your device settings to
          estimate repetitions during this exercise.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onClose(false)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View
        style={[
          styles.root,
          styles.center,
          styles.statePadding,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.stateIcon}>
          <Activity size={34} color="#247A4A" />
        </View>

        <Text style={styles.stateTitle}>
          Couldn't prepare your session
        </Text>

        <Text style={styles.stateDescription}>
          Check that you're signed in and connected to the internet,
          then try opening this exercise again.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onClose(false)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F8F5"
      />

      {/* HEADER */}
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 10) + 8 },
        ]}
      >
        <TouchableOpacity
          onPress={safeClose}
          style={styles.headerButton}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Exit exercise"
          activeOpacity={0.8}
        >
          <ArrowLeft size={21} color="#294436" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>MOVEMENT SESSION</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {exercise.title}
          </Text>
        </View>

        <View style={styles.headerBadge}>
          <Activity size={17} color="#247A4A" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
      >
        {/* LIVE STATUS */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              running ? styles.statusPillLive : styles.statusPillPaused,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                running ? styles.statusDotLive : styles.statusDotPaused,
              ]}
            />
            <Text style={styles.statusText}>
              {running ? "TRACKING LIVE" : "SESSION PAUSED"}
            </Text>
          </View>

          <View style={styles.sensorIndicator}>
            <ShieldCheck size={14} color="#6C8A76" />
            <Text style={styles.sensorIndicatorText}>
              Device sensor
            </Text>
          </View>
        </View>

        {/* HERO COUNTER */}
        <LinearGradient
          colors={["#E6F4EA", "#D2ECDD", "#C5E4D1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />

          <View style={styles.heroHeading}>
            <View>
              <Text style={styles.heroEyebrow}>
                YOUR MOVEMENT
              </Text>
              <Text style={styles.heroTitle}>
                One rep at a time.
              </Text>
            </View>

            <View style={styles.heroSparkle}>
              <Sparkles size={20} color="#247A4A" />
            </View>
          </View>

          <Animated.View
            style={[
              styles.counterCircle,
              { transform: [{ scale: pulse }] },
            ]}
          >
            <View style={styles.counterInnerRing}>
              <Text style={styles.counterValue}>{reps}</Text>
              <Text style={styles.counterLabel}>
                ESTIMATED REPS
              </Text>
            </View>
          </Animated.View>

          <View style={styles.heroFooter}>
            <View style={styles.heroFooterIcon}>
              <Target size={16} color="#247A4A" />
            </View>

            <Text style={styles.heroFooterText}>
              {running
                ? "Move naturally and let your phone track motion."
                : "Take a breath. Resume when you're ready."}
            </Text>
          </View>
        </LinearGradient>

        {/* METRICS */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricIcon}>
              <Clock3 size={18} color="#247A4A" />
            </View>

            <Text style={styles.metricLabel}>DURATION</Text>
            <Text style={styles.metricValue}>
              {formatTime(elapsed)}
            </Text>
            <Text style={styles.metricCaption}>Time elapsed</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIcon, styles.metricIconMint]}>
              <Dumbbell size={18} color="#247A4A" />
            </View>

            <Text style={styles.metricLabel}>REPETITIONS</Text>
            <Text style={styles.metricValue}>{reps}</Text>
            <Text style={styles.metricCaption}>Motion estimate</Text>
          </View>
        </View>

        {/* ACTIVITY DETAILS */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsIcon}>
            <TrendingUp size={19} color="#247A4A" />
          </View>

          <View style={styles.detailsText}>
            <Text style={styles.detailsTitle}>
              Keep your rhythm
            </Text>
            <Text style={styles.detailsDescription}>
              Consistent, controlled movements help the sensor
              distinguish repetitions from small movements.
            </Text>
          </View>
        </View>

        {/* CONTROLS */}
        <Text style={styles.controlsHeading}>SESSION CONTROLS</Text>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetCounter}
            disabled={saving}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Reset rep counter"
          >
            <RotateCcw size={19} color="#41664E" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainControl}
            onPress={toggleRunning}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              running ? "Pause exercise" : "Resume exercise"
            }
          >
            <LinearGradient
              colors={
                running
                  ? ["#FFFFFF", "#F3F8F4"]
                  : ["#2C8552", "#17613B"]
              }
              style={[
                styles.mainControlGradient,
                running && styles.pauseControlGradient,
              ]}
            >
              {saving ? (
                <ActivityIndicator
                  color={running ? "#247A4A" : "#FFFFFF"}
                />
              ) : running ? (
                <Pause size={22} color="#247A4A" fill="#247A4A" />
              ) : (
                <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
              )}

              <Text
                style={[
                  styles.mainControlText,
                  running && styles.pauseControlText,
                ]}
              >
                {saving
                  ? "Saving..."
                  : running
                    ? "Pause session"
                    : "Resume session"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.finishButton,
            saving && styles.disabledButton,
          ]}
          onPress={() => void finish()}
          disabled={saving || !sessionId}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Finish and save exercise"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Check size={19} color="#FFFFFF" strokeWidth={2.5} />
          )}

          <Text style={styles.finishButtonText}>
            {saving ? "Saving your progress..." : "Finish & Save Session"}
          </Text>
        </TouchableOpacity>

        <View style={styles.footerNote}>
          <ShieldCheck size={15} color="#8AA292" />
          <Text style={styles.footerNoteText}>
            Your session is saved to your Wellness AI account.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.exitLink}
          onPress={safeClose}
          disabled={saving}
          activeOpacity={0.7}
        >
          <X size={14} color="#89968D" />
          <Text style={styles.exitLinkText}>End without completing</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F8F5",
  },

  center: {
    alignItems: "center",
    justifyContent: "center",
  },

  statePadding: {
    paddingHorizontal: 28,
  },

  loadingIcon: {
    width: 82,
    height: 82,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingSpinner: {
    marginTop: 24,
  },

  loadingTitle: {
    marginTop: 18,
    color: "#293D31",
    fontSize: 20,
    fontWeight: "800",
  },

  loadingText: {
    marginTop: 8,
    color: "#7A8B80",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 22,
  },

  stateIcon: {
    width: 82,
    height: 82,
    borderRadius: 27,
    backgroundColor: "#E3F2E7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 23,
  },

  stateTitle: {
    color: "#293D31",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },

  stateDescription: {
    color: "#7A8B80",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },

  primaryButton: {
    marginTop: 27,
    minWidth: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#247A4A",
    paddingHorizontal: 26,
    paddingVertical: 15,
    borderRadius: 17,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 19,
    paddingBottom: 17,
  },

  headerButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3ECE5",
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },

  eyebrow: {
    color: "#7D9885",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: "#293D31",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },

  headerBadge: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#E4F2E8",
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 13,
    gap: 7,
  },

  statusPillLive: {
    backgroundColor: "#E1F3E6",
  },

  statusPillPaused: {
    backgroundColor: "#F8EFD9",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusDotLive: {
    backgroundColor: "#239451",
  },

  statusDotPaused: {
    backgroundColor: "#D19A2B",
  },

  statusText: {
    color: "#477657",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  sensorIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  sensorIndicatorText: {
    color: "#819087",
    fontSize: 10,
    fontWeight: "600",
  },

  heroCard: {
    borderRadius: 28,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D0E7D7",
    marginBottom: 17,
  },

  heroOrbOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -100,
    right: -65,
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  heroOrbTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    bottom: -90,
    left: -75,
    backgroundColor: "rgba(255,255,255,0.23)",
  },

  heroHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroEyebrow: {
    color: "#5E8A6B",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.6,
  },

  heroTitle: {
    color: "#254B34",
    fontSize: 19,
    fontWeight: "800",
    marginTop: 6,
  },

  heroSparkle: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },

  counterCircle: {
    alignSelf: "center",
    width: 222,
    height: 222,
    borderRadius: 111,
    backgroundColor: "#247A4A",
    marginTop: 25,
    marginBottom: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 9,
    shadowColor: "#175D36",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.19,
    shadowRadius: 14,
  },

  counterInnerRing: {
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
  },

  counterValue: {
    color: "#FFFFFF",
    fontSize: 75,
    fontWeight: "900",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },

  counterLabel: {
    color: "#C7E8D2",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2.2,
    marginTop: 2,
  },

  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 15,
    gap: 9,
  },

  heroFooterIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  heroFooterText: {
    flex: 1,
    color: "#52735D",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 15,
  },

  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 17,
  },

  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    padding: 15,
  },

  metricIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#E4F3E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  metricIconMint: {
    backgroundColor: "#E8F5EE",
  },

  metricLabel: {
    color: "#91A096",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  metricValue: {
    color: "#2D4937",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 7,
    fontVariant: ["tabular-nums"],
  },

  metricCaption: {
    color: "#93A097",
    fontSize: 10,
    marginTop: 4,
  },

  detailsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    backgroundColor: "#EAF4ED",
    borderRadius: 20,
    marginBottom: 25,
    gap: 12,
  },

  detailsIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  detailsText: {
    flex: 1,
  },

  detailsTitle: {
    color: "#31553D",
    fontSize: 12,
    fontWeight: "800",
  },

  detailsDescription: {
    color: "#789080",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  controlsHeading: {
    color: "#819287",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 13,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 13,
  },

  resetButton: {
    width: 57,
    height: 57,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3ECE5",
    alignItems: "center",
    justifyContent: "center",
  },

  mainControl: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#247A4A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
  },

  mainControlGradient: {
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },

  pauseControlGradient: {
    borderWidth: 1,
    borderColor: "#DDE9E0",
  },

  mainControlText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  pauseControlText: {
    color: "#247A4A",
  },

  finishButton: {
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#247A4A",
    elevation: 3,
    shadowColor: "#247A4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },

  disabledButton: {
    opacity: 0.55,
  },

  finishButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 18,
  },

  footerNoteText: {
    color: "#84968A",
    fontSize: 10,
    textAlign: "center",
  },

  exitLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 18,
    paddingVertical: 8,
  },

  exitLinkText: {
    color: "#89968D",
    fontSize: 11,
    fontWeight: "600",
  },
});
