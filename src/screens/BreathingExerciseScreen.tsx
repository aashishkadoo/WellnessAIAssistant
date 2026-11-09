// src/screens/BreathingExerciseScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import { supabase } from "../lib/supabase";

type Props = {
  user: any;
  onBack: () => void;
};

// Four equal box-breathing phases.
// 3.75 seconds x 4 phases x 20 cycles = exactly 5 minutes.
const PHASE_DURATION_MS = 3750;
const CYCLE_DURATION_MS = PHASE_DURATION_MS * 4;
const TOTAL_DURATION_MS = 5 * 60 * 1000;
const TOTAL_CYCLES = TOTAL_DURATION_MS / CYCLE_DURATION_MS;

const phases = [
  {
    name: "Breathe In",
    instruction: "Slowly breathe in through your nose",
    scale: 1.45,
  },
  {
    name: "Hold",
    instruction: "Gently hold your breath",
    scale: 1.45,
  },
  {
    name: "Breathe Out",
    instruction: "Slowly breathe out",
    scale: 1,
  },
  {
    name: "Hold",
    instruction: "Gently hold before your next breath",
    scale: 1,
  },
];

function formatTime(milliseconds: number) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function BreathingExerciseScreen({
  user,
  onBack,
}: Props) {
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saveError, setSaveError] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const completionHandledRef = useRef(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Derive the current phase and cycle from elapsed time.
  const safeElapsedMs = Math.min(elapsedMs, TOTAL_DURATION_MS);
  const elapsedInCycle = safeElapsedMs % CYCLE_DURATION_MS;
  const phaseIndex = Math.min(
    Math.floor(elapsedInCycle / PHASE_DURATION_MS),
    phases.length - 1
  );
  const currentPhase = phases[phaseIndex];
  const elapsedInPhase = elapsedInCycle % PHASE_DURATION_MS;
  const phaseSecondsLeft = Math.ceil(
    (PHASE_DURATION_MS - elapsedInPhase) / 1000
  );
  const remainingMs = Math.max(TOTAL_DURATION_MS - safeElapsedMs, 0);
  const cycle = Math.min(
    Math.floor(safeElapsedMs / CYCLE_DURATION_MS) + 1,
    TOTAL_CYCLES
  );

  const saveCompletedExercise = useCallback(async () => {
    if (!user?.id) {
      console.log("Breathing exercise completed, but no user ID was available.");
      return;
    }

    const { error } = await supabase.from("daily_activities").insert({
      user_id: user.id,
      activity_type: "breathing",
      activity_date: getLocalDateKey(),
      duration_minutes: 5,
      completed: true,
    });

    if (error) {
      console.log("Error saving breathing activity:", error.message);
      setSaveError(true);
    } else {
      console.log("Five-minute breathing exercise saved successfully.");
      setSaveError(false);
    }
  }, [user?.id]);

  // Keep the exercise duration tied to real elapsed time rather than
  // counting down with repeated one-second timeouts.
  useEffect(() => {
    if (!started || startedAtRef.current === null) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current!;
      const boundedElapsed = Math.min(elapsed, TOTAL_DURATION_MS);

      setElapsedMs(boundedElapsed);

      if (elapsed >= TOTAL_DURATION_MS) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [started]);

  // Complete and save once when the five-minute duration is reached.
  useEffect(() => {
    if (
      !started ||
      elapsedMs < TOTAL_DURATION_MS ||
      completionHandledRef.current
    ) {
      return;
    }

    completionHandledRef.current = true;
    setStarted(false);
    setCompleted(true);
    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);
    void saveCompletedExercise();
  }, [elapsedMs, started, saveCompletedExercise, scaleAnim]);

  // Animate the circle to match the current breathing phase.
  useEffect(() => {
    if (!started || completed) {
      return;
    }

    scaleAnim.stopAnimation();
    Animated.timing(scaleAnim, {
      toValue: currentPhase.scale,
      duration: PHASE_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [phaseIndex, started, completed, currentPhase.scale, scaleAnim]);

  function startExercise() {
    completionHandledRef.current = false;
    startedAtRef.current = Date.now();

    setElapsedMs(0);
    setSaveError(false);
    setCompleted(false);
    setStarted(true);

    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);
  }

  function resetExercise() {
    setStarted(false);
    setCompleted(false);
    setElapsedMs(0);
    setSaveError(false);
    startedAtRef.current = null;
    completionHandledRef.current = false;

    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);
  }

  function endExercise() {
    setStarted(false);
    startedAtRef.current = null;
    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);
    onBack();
  }

  // Introduction screen
  if (!started && !completed) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>🌬️</Text>
          <Text style={styles.title}>Box Breathing</Text>
          <Text style={styles.subtitle}>
            Slow down, breathe deeply, and give yourself five minutes to relax.
          </Text>
        </View>

        <View style={styles.previewCircle}>
          <Text style={styles.previewEmoji}>🌿</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>⏱️</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Exactly 5 minutes</Text>
              <Text style={styles.infoDescription}>
                A timed breathing and relaxation exercise
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🔄</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>20 breathing cycles</Text>
              <Text style={styles.infoDescription}>
                Inhale, hold, exhale, and hold
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🫁</Text>
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoTitle}>Equal breathing phases</Text>
              <Text style={styles.infoDescription}>
                Follow the circle and breathe at a comfortable pace
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={startExercise}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Start 5-Minute Breathing</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Completion screen
  if (completed) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.completedContainer}>
          <Text style={styles.completedEmoji}>🎉</Text>
          <Text style={styles.completedTitle}>Well Done!</Text>
          <Text style={styles.completedSubtitle}>
            You completed your five-minute box breathing exercise.
          </Text>

          <View style={styles.completedCard}>
            <Text style={styles.completedCardTitle}>
              🌿 Exercise Complete
            </Text>
            <Text style={styles.completedCardText}>
              Take a moment to notice how you feel. Your five-minute session
              has finished.
            </Text>
            <Text style={styles.savedStatus}>
              {saveError
                ? "Your session finished, but it could not be synced to your account."
                : "Your progress has been saved."}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>Back to Wellness</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={resetExercise}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Do It Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Active breathing exercise
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={endExercise}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>✕ End Exercise</Text>
      </TouchableOpacity>

      <Text style={styles.activeTitle}>Follow Your Breath</Text>
      <Text style={styles.cycleText}>
        Cycle {cycle} of {TOTAL_CYCLES}
      </Text>

      <View style={styles.overallTimerCard}>
        <Text style={styles.overallTimerLabel}>TIME REMAINING</Text>
        <Text style={styles.overallTimer}>{formatTime(remainingMs)}</Text>
        <View style={styles.overallProgressTrack}>
          <View
            style={[
              styles.overallProgressFill,
              {
                width: `${(safeElapsedMs / TOTAL_DURATION_MS) * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.breathingArea}>
        <Animated.View
          style={[
            styles.breathingCircle,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.innerCircle}>
            <Text style={styles.leaf}>🌿</Text>
          </View>
        </Animated.View>
      </View>

      <Text style={styles.phaseText}>{currentPhase.name}</Text>
      <Text style={styles.timerText}>{phaseSecondsLeft}</Text>
      <Text style={styles.instructionText}>{currentPhase.instruction}</Text>

      <View style={styles.progressContainer}>
        {phases.map((phase, index) => (
          <View
            key={phase.name + index}
            style={[
              styles.progressDot,
              index === phaseIndex && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <Text style={styles.phaseHint}>
        Inhale · Hold · Exhale · Hold
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FAF7",
    paddingHorizontal: 24,
    paddingTop: 55,
    alignItems: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: "#4A6655",
    fontWeight: "500",
  },
  header: {
    alignItems: "center",
    marginTop: 5,
  },
  emoji: {
    fontSize: 42,
    marginBottom: 12,
  },
  title: {
    fontSize: 29,
    fontWeight: "700",
    color: "#24352B",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#718078",
    textAlign: "center",
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 330,
  },
  previewCircle: {
    width: 145,
    height: 145,
    borderRadius: 75,
    backgroundColor: "#DDF2E5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 22,
  },
  previewEmoji: {
    fontSize: 48,
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  infoIcon: {
    fontSize: 25,
    marginRight: 15,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#26382D",
  },
  infoDescription: {
    fontSize: 13,
    color: "#7B8981",
    marginTop: 3,
    lineHeight: 18,
  },
  startButton: {
    width: "100%",
    backgroundColor: "#4CAF7D",
    paddingVertical: 17,
    borderRadius: 30,
    alignItems: "center",
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  activeTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#26382D",
    marginTop: 2,
  },
  cycleText: {
    fontSize: 15,
    color: "#7B8981",
    marginTop: 7,
  },
  overallTimerCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
    alignItems: "center",
  },
  overallTimerLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: "#7B8981",
  },
  overallTimer: {
    fontSize: 30,
    fontWeight: "700",
    color: "#31493A",
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  overallProgressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#E5EEE8",
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 10,
  },
  overallProgressFill: {
    height: "100%",
    backgroundColor: "#4CAF7D",
    borderRadius: 5,
  },
  breathingArea: {
    height: 260,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  breathingCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#CFECDD",
    justifyContent: "center",
    alignItems: "center",
  },
  innerCircle: {
    width: 145,
    height: 145,
    borderRadius: 75,
    backgroundColor: "#E9F7EE",
    justifyContent: "center",
    alignItems: "center",
  },
  leaf: {
    fontSize: 50,
  },
  phaseText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#31493A",
    marginTop: 0,
  },
  timerText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#4CAF7D",
    marginTop: 0,
    fontVariant: ["tabular-nums"],
  },
  instructionText: {
    fontSize: 15,
    color: "#718078",
    textAlign: "center",
    marginTop: 3,
  },
  progressContainer: {
    flexDirection: "row",
    marginTop: 20,
    gap: 8,
  },
  progressDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#D3DED7",
  },
  progressDotActive: {
    width: 25,
    backgroundColor: "#4CAF7D",
  },
  phaseHint: {
    color: "#8A9990",
    fontSize: 12,
    marginTop: 14,
    letterSpacing: 0.4,
  },
  completedContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 35,
  },
  completedEmoji: {
    fontSize: 70,
  },
  completedTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#26382D",
    marginTop: 15,
  },
  completedSubtitle: {
    fontSize: 16,
    color: "#718078",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 24,
  },
  completedCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    marginTop: 30,
    marginBottom: 25,
    alignItems: "center",
  },
  completedCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#31493A",
  },
  completedCardText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#718078",
    textAlign: "center",
    marginTop: 10,
  },
  savedStatus: {
    fontSize: 12,
    lineHeight: 18,
    color: "#4A6655",
    textAlign: "center",
    marginTop: 12,
  },
  secondaryButton: {
    marginTop: 15,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#4CAF7D",
    fontSize: 16,
    fontWeight: "600",
  },
});
