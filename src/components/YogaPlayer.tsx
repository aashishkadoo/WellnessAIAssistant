
// src/components/YogaPlayer.tsx

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import LinearGradient from "react-native-linear-gradient";
import {
  ArrowLeft,
  Play,
  Pause,
  Check,
  Clock3,
  Flower2,
  Leaf,
  Sparkles,
  ShieldCheck,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type Props = {
  user: any;
  exercise: {
    id: string;
    title: string;
    category: string;
    type: string;
  };
  video: {
    youtube_video_id: string;
    title: string;
    duration_seconds?: number | null;
  };
  onClose: () => void;
};

export default function YogaPlayer({
  user,
  exercise,
  video,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const [playing, setPlaying] = useState(false);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  // Refs prevent duplicate saves and stale timer values.
  const watchedSecondsRef = useRef(0);
  const savingRef = useRef(false);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();

    intervalRef.current = setInterval(() => {
      watchedSecondsRef.current += 1;

      if (mountedRef.current) {
        setWatchedSeconds(watchedSecondsRef.current);
      }
    }, 1000);
  }, [stopTimer]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      stopTimer();
    };
  }, [stopTimer]);

  // Pause the session timer when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState) => {
        const wasActive = appState.current === "active";
        const isBackground =
          nextState === "inactive" || nextState === "background";

        if (wasActive && isBackground) {
          setPlaying(false);
          stopTimer();
        }

        appState.current = nextState;
      }
    );

    return () => subscription.remove();
  }, [stopTimer]);

  const handleComplete = useCallback(async () => {
    if (savingRef.current || completedRef.current) {
      return;
    }

    if (!user?.id) {
      Alert.alert(
        "Sign in required",
        "Your wellness session cannot be saved without an authenticated user."
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setPlaying(false);
    stopTimer();

    const duration = watchedSecondsRef.current;

    try {
      const { error } = await supabase
        .from("wellness_sessions")
        .insert({
          user_id: user.id,
          exercise_id: exercise.id,
          session_type: exercise.type,
          category: exercise.category,
          duration_seconds: duration,
          completed: true,
          completed_at: new Date().toISOString(),
          metadata: {
            youtube_video_id: video.youtube_video_id,
            video_title: video.title,
            source: "yoga_player",
          },
        });

      if (error) {
        throw error;
      }

      completedRef.current = true;

      if (!mountedRef.current) {
        return;
      }

      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;

      Alert.alert(
        "Namaste 🙏",
        `Beautiful work! Your ${exercise.title} session has been saved.\n\nTime practised: ${minutes}m ${String(
          seconds
        ).padStart(2, "0")}s`,
        [
          {
            text: "Done",
            onPress: onClose,
          },
        ]
      );
    } catch (error) {
      if (mountedRef.current) {
        const message =
          error instanceof Error
            ? error.message
            : "Please check your connection and try again.";

        Alert.alert("Could not save session", message);
      }
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    user,
    exercise,
    video,
    onClose,
    stopTimer,
  ]);

  const onStateChange = useCallback(
    (state: string) => {
      if (state === "playing") {
        setPlaying(true);
        startTimer();
        return;
      }

      stopTimer();
      setPlaying(false);

      if (state === "ended") {
        void handleComplete();
      }
    },
    [startTimer, stopTimer, handleComplete]
  );

  const handlePlaybackToggle = useCallback(() => {
    if (saving || completedRef.current) {
      return;
    }

    setPlaying((current) => !current);
  }, [saving]);

  const handleClose = useCallback(() => {
    if (savingRef.current) {
      Alert.alert(
        "Saving your session",
        "Please wait until your session has finished saving."
      );
      return;
    }

    if (watchedSecondsRef.current >= 15 && !completedRef.current) {
      Alert.alert(
        "Leave your practice?",
        "Your current session has not been saved. You can save it before leaving.",
        [
          {
            text: "Keep practising",
            style: "cancel",
          },
          {
            text: "Save session",
            onPress: () => {
              void handleComplete();
            },
          },
          {
            text: "Leave without saving",
            style: "destructive",
            onPress: onClose,
          },
        ]
      );
      return;
    }

    onClose();
  }, [handleComplete, onClose]);

  const minutes = Math.floor(watchedSeconds / 60);
  const seconds = watchedSeconds % 60;

  const durationSeconds = video.duration_seconds ?? 0;

  const progressPercent =
    durationSeconds > 0
      ? Math.min(100, (watchedSeconds / durationSeconds) * 100)
      : 0;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 8) },
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F8F5"
      />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.backButton}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Close yoga player"
        >
          <ArrowLeft size={21} color="#294436" strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarTitle}>Mindful Movement</Text>
          <Text style={styles.topBarSubtitle}>YOUR YOGA SPACE</Text>
        </View>

        <View style={styles.topBarIcon}>
          <Flower2 size={21} color="#247A4A" strokeWidth={1.8} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 12) + 30 },
        ]}
      >
        {/* WELCOME BANNER */}
        <LinearGradient
          colors={["#E6F5EA", "#F2F8F3"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeBanner}
        >
          <View style={styles.welcomeIcon}>
            <Sparkles size={19} color="#247A4A" strokeWidth={1.9} />
          </View>

          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeTitle}>
              Make space for yourself
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Breathe deeply. Move gently. Be present.
            </Text>
          </View>

          <Leaf size={25} color="#8AB99A" strokeWidth={1.5} />
        </LinearGradient>

        {/* VIDEO CARD */}
        <View style={styles.videoCard}>
          <View style={styles.videoHeader}>
            <View style={styles.videoHeaderText}>
              <Text style={styles.videoEyebrow}>
                NOW PLAYING
              </Text>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {video.title || exercise.title}
              </Text>
            </View>

            <View style={styles.yogaBadge}>
              <Flower2 size={14} color="#247A4A" />
              <Text style={styles.yogaBadgeText}>YOGA</Text>
            </View>
          </View>

          <View style={styles.videoFrame}>
            <YoutubePlayer
              height={225}
              play={playing}
              videoId={video.youtube_video_id}
              onChangeState={onStateChange}
              onReady={() => setPlayerReady(true)}
            />

            {!playerReady && (
              <View style={styles.videoLoadingOverlay}>
                <ActivityIndicator size="large" color="#247A4A" />
                <Text style={styles.videoLoadingText}>
                  Preparing your practice...
                </Text>
              </View>
            )}
          </View>

          <View style={styles.videoFooter}>
            <ShieldCheck
              size={15}
              color="#779383"
              strokeWidth={1.8}
            />
            <Text style={styles.videoFooterText}>
              Take your time and practise at your own pace.
            </Text>
          </View>
        </View>

        {/* SESSION TIMER */}
        <LinearGradient
          colors={["#247A4A", "#185D39"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.timerCard}
        >
          <View style={styles.timerDecoration} />

          <View style={styles.timerTopRow}>
            <View>
              <Text style={styles.timerEyebrow}>
                YOUR PRACTICE
              </Text>
              <Text style={styles.timerHeading}>
                Time well spent
              </Text>
            </View>

            <View style={styles.timerIcon}>
              <Clock3 size={22} color="#E0F4E6" strokeWidth={1.8} />
            </View>
          </View>

          <View style={styles.timerValueRow}>
            <Text style={styles.timerValue}>
              {String(minutes).padStart(2, "0")}
            </Text>
            <Text style={styles.timerUnit}>min</Text>

            <View style={styles.timerSeparator} />

            <Text style={styles.timerValue}>
              {String(seconds).padStart(2, "0")}
            </Text>
            <Text style={styles.timerUnit}>sec</Text>
          </View>

          {durationSeconds > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>

              <Text style={styles.progressLabel}>
                {Math.round(progressPercent)}% of video duration
              </Text>
            </View>
          )}

          <View style={styles.timerStatusRow}>
            <View
              style={[
                styles.statusDot,
                playing && styles.statusDotActive,
              ]}
            />
            <Text style={styles.timerStatus}>
              {saving
                ? "Saving your session..."
                : playing
                  ? "Practice in progress"
                  : watchedSeconds > 0
                    ? "Paused — take a breath"
                    : "Ready when you are"}
            </Text>
          </View>
        </LinearGradient>

        {/* PLAYBACK CONTROLS */}
        <View style={styles.controlsSection}>
          <Text style={styles.controlsTitle}>Your session</Text>
          <Text style={styles.controlsSubtitle}>
            Follow along and finish when you feel ready.
          </Text>

          <TouchableOpacity
            style={[
              styles.playButton,
              (saving || completedRef.current) && styles.disabledButton,
            ]}
            onPress={handlePlaybackToggle}
            disabled={saving || completedRef.current}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause video" : "Play video"}
          >
            <LinearGradient
              colors={["#287F50", "#1C693F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButtonGradient}
            >
              {playing ? (
                <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
              )}

              <Text style={styles.playButtonText}>
                {playing ? "Pause Practice" : "Resume Practice"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.completeButton,
              saving && styles.disabledButton,
            ]}
            onPress={() => void handleComplete()}
            disabled={saving || completedRef.current}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save and complete yoga session"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#247A4A" />
            ) : (
              <View style={styles.completeIcon}>
                <Check size={18} color="#247A4A" strokeWidth={2.5} />
              </View>
            )}

            <Text style={styles.completeButtonText}>
              {saving ? "Saving session..." : "Complete & Save Session"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* MINDFULNESS FOOTER */}
        <View style={styles.footerCard}>
          <View style={styles.footerIcon}>
            <Leaf size={20} color="#247A4A" strokeWidth={1.8} />
          </View>

          <View style={styles.footerTextContainer}>
            <Text style={styles.footerTitle}>
              There is no perfect practice
            </Text>
            <Text style={styles.footerSubtitle}>
              Showing up for yourself is already a meaningful step.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F8F5",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 17,
  },

  backButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EDE7",
    alignItems: "center",
    justifyContent: "center",
  },

  topBarTitleContainer: {
    flex: 1,
    marginLeft: 13,
  },

  topBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#294436",
  },

  topBarSubtitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#7B9584",
    marginTop: 4,
  },

  topBarIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#E5F3E9",
    alignItems: "center",
    justifyContent: "center",
  },

  scrollContent: {
    paddingHorizontal: 18,
  },

  welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DFEEE3",
    marginBottom: 20,
  },

  welcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  welcomeTextContainer: {
    flex: 1,
  },

  welcomeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2D5B3E",
  },

  welcomeSubtitle: {
    fontSize: 10,
    lineHeight: 16,
    color: "#799181",
    marginTop: 4,
  },

  videoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 13,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    marginBottom: 19,
    shadowColor: "#234B34",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },

  videoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 5,
    paddingBottom: 14,
  },

  videoHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  videoEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#6C9A7A",
    marginBottom: 6,
  },

  videoTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800",
    color: "#293D31",
  },

  yogaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EAF5ED",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  yogaBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: "#247A4A",
  },

  videoFrame: {
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#17271D",
    minHeight: 225,
    justifyContent: "center",
  },

  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F6F1",
  },

  videoLoadingText: {
    fontSize: 12,
    color: "#587563",
    fontWeight: "600",
    marginTop: 10,
  },

  videoFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingTop: 13,
    gap: 7,
  },

  videoFooterText: {
    flex: 1,
    fontSize: 10,
    color: "#829087",
    lineHeight: 15,
  },

  timerCard: {
    borderRadius: 25,
    padding: 22,
    overflow: "hidden",
    marginBottom: 25,
    shadowColor: "#185C38",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 5,
  },

  timerDecoration: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -95,
    right: -55,
    backgroundColor: "rgba(255,255,255,0.055)",
  },

  timerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  timerEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: "#BDE4CA",
  },

  timerHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 6,
  },

  timerIcon: {
    width: 45,
    height: 45,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },

  timerValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 22,
  },

  timerValue: {
    fontSize: 43,
    fontWeight: "800",
    letterSpacing: -1.5,
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },

  timerUnit: {
    fontSize: 12,
    fontWeight: "600",
    color: "#C6E8D0",
    marginLeft: 5,
    marginRight: 12,
  },

  timerSeparator: {
    width: 1,
    height: 29,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 9,
  },

  progressContainer: {
    marginTop: 15,
  },

  progressTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#B9E8C8",
  },

  progressLabel: {
    fontSize: 10,
    color: "#D4ECDD",
    marginTop: 7,
  },

  timerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    gap: 8,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D7E9DC",
  },

  statusDotActive: {
    backgroundColor: "#8EE5AA",
  },

  timerStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E0F1E5",
  },

  controlsSection: {
    marginBottom: 23,
  },

  controlsTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#293D31",
  },

  controlsSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#849187",
    marginTop: 5,
    marginBottom: 17,
  },

  playButton: {
    borderRadius: 17,
    overflow: "hidden",
    marginBottom: 11,
    shadowColor: "#247A4A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 3,
  },

  playButtonGradient: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 11,
    paddingHorizontal: 18,
  },

  playButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  completeButton: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE9DF",
  },

  completeIcon: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: "#E5F3E9",
    alignItems: "center",
    justifyContent: "center",
  },

  completeButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#247A4A",
  },

  disabledButton: {
    opacity: 0.6,
  },

  footerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#EAF4ED",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#DFECE2",
  },

  footerIcon: {
    width: 41,
    height: 41,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  footerTextContainer: {
    flex: 1,
  },

  footerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#315C40",
  },

  footerSubtitle: {
    fontSize: 10,
    lineHeight: 16,
    color: "#7A9081",
    marginTop: 4,
  },
});
