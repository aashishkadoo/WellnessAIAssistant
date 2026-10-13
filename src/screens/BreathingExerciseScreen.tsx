//src/screens/BreathingExerciseScreen.tsx
import React, { useEffect, useRef, useState } from "react";
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

const phases = [
  {
    name: "Breathe In",
    duration: 4,
    scale: 1.45,
  },
  {
    name: "Hold",
    duration: 4,
    scale: 1.45,
  },
  {
    name: "Breathe Out",
    duration: 6,
    scale: 1,
  },
];

const TOTAL_CYCLES = 5;

export default function BreathingExerciseScreen({
  user,
  onBack,
}: Props) {
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    phases[0].duration
  );

  const [cycle, setCycle] = useState(1);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const currentPhase = phases[phaseIndex];

  /*
   * Start / control the breathing timer
   */
  useEffect(() => {
    if (!started || completed) {
      return;
    }

    if (secondsLeft > 0) {
      const timer = setTimeout(() => {
        setSecondsLeft((previous) => previous - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    /*
     * Move to the next breathing phase
     */
    if (phaseIndex < phases.length - 1) {
      const nextPhase = phaseIndex + 1;

      setPhaseIndex(nextPhase);
      setSecondsLeft(phases[nextPhase].duration);

      return;
    }

    /*
     * Finished one complete breathing cycle
     */
    if (cycle < TOTAL_CYCLES) {
      setCycle((previous) => previous + 1);
      setPhaseIndex(0);
      setSecondsLeft(phases[0].duration);

      return;
    }

    /*
     * Finished the entire exercise
     */
    finishExercise();
  }, [
    started,
    completed,
    secondsLeft,
    phaseIndex,
    cycle,
  ]);

  /*
   * Animate the breathing circle
   */
  useEffect(() => {
    if (!started || completed) {
      return;
    }

    Animated.timing(scaleAnim, {
      toValue: currentPhase.scale,
      duration: currentPhase.duration * 1000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [
    phaseIndex,
    started,
    completed,
    currentPhase,
    scaleAnim,
  ]);

  /*
   * Start exercise
   */
  function startExercise() {
    setStarted(true);
    setCompleted(false);
    setPhaseIndex(0);
    setSecondsLeft(phases[0].duration);
    setCycle(1);

    scaleAnim.setValue(1);
  }

  /*
   * Save completed exercise to Supabase
   */
  async function finishExercise() {
    setCompleted(true);

    if (!user?.id) {
      console.log("No user ID available.");
      return;
    }

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const { error } = await supabase
      .from("daily_activities")
      .insert({
        user_id: user.id,
        activity_type: "breathing",
        activity_date: today,
        duration_minutes: 1,
        completed: true,
      });

    if (error) {
      console.log(
        "Error saving breathing activity:",
        error.message
      );
    } else {
      console.log(
        "Breathing exercise saved successfully."
      );
    }
  }

  /*
   * Reset exercise
   */
  function resetExercise() {
    setStarted(false);
    setCompleted(false);
    setPhaseIndex(0);
    setSecondsLeft(phases[0].duration);
    setCycle(1);

    scaleAnim.stopAnimation();
    scaleAnim.setValue(1);
  }

  /*
   * Exercise introduction screen
   */
  if (!started && !completed) {
    return (
      <View style={styles.container}>

        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.emoji}>
            🌬️
          </Text>

          <Text style={styles.title}>
            Breathing Exercise
          </Text>

          <Text style={styles.subtitle}>
            Slow down, breathe deeply, and give
            yourself a moment to relax.
          </Text>
        </View>

        <View style={styles.previewCircle}>
          <Text style={styles.previewEmoji}>
            🌿
          </Text>
        </View>

        <View style={styles.infoCard}>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>
              ⏱️
            </Text>

            <View>
              <Text style={styles.infoTitle}>
                About 1 minute
              </Text>

              <Text style={styles.infoDescription}>
                A quick relaxation exercise
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>
              🔄
            </Text>

            <View>
              <Text style={styles.infoTitle}>
                5 breathing cycles
              </Text>

              <Text style={styles.infoDescription}>
                Inhale, hold, and exhale
              </Text>
            </View>
          </View>

        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={startExercise}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>
            Start Breathing
          </Text>
        </TouchableOpacity>

      </View>
    );
  }

  /*
   * Exercise completed screen
   */
  if (completed) {
    return (
      <View style={styles.container}>

        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </TouchableOpacity>

        <View style={styles.completedContainer}>

          <Text style={styles.completedEmoji}>
            🎉
          </Text>

          <Text style={styles.completedTitle}>
            Well Done!
          </Text>

          <Text style={styles.completedSubtitle}>
            You completed your breathing exercise.
          </Text>

          <View style={styles.completedCard}>

            <Text style={styles.completedCardTitle}>
              🌿 Exercise Complete
            </Text>

            <Text style={styles.completedCardText}>
              Take a moment to notice how you feel.
              Your progress has been saved.
            </Text>

          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={onBack}
          >
            <Text style={styles.startButtonText}>
              Back to Wellness
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={resetExercise}
          >
            <Text style={styles.secondaryButtonText}>
              Do It Again
            </Text>
          </TouchableOpacity>

        </View>

      </View>
    );
  }

  /*
   * Active breathing exercise
   */
  return (
    <View style={styles.container}>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backText}>
          ✕ End Exercise
        </Text>
      </TouchableOpacity>

      <Text style={styles.activeTitle}>
        Follow Your Breath
      </Text>

      <Text style={styles.cycleText}>
        Cycle {cycle} of {TOTAL_CYCLES}
      </Text>

      <View style={styles.breathingArea}>

        <Animated.View
          style={[
            styles.breathingCircle,
            {
              transform: [
                {
                  scale: scaleAnim,
                },
              ],
            },
          ]}
        >
          <View style={styles.innerCircle}>
            <Text style={styles.leaf}>
              🌿
            </Text>
          </View>
        </Animated.View>

      </View>

      <Text style={styles.phaseText}>
        {currentPhase.name}
      </Text>

      <Text style={styles.timerText}>
        {secondsLeft}
      </Text>

      <Text style={styles.instructionText}>
        {currentPhase.name === "Breathe In"
          ? "Slowly breathe in through your nose"
          : currentPhase.name === "Hold"
          ? "Hold your breath gently"
          : "Slowly breathe out"}
      </Text>

      <View style={styles.progressContainer}>

        {phases.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === phaseIndex &&
                styles.progressDotActive,
            ]}
          />
        ))}

      </View>

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
    marginBottom: 25,
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
    marginTop: 25,
    marginBottom: 25,
  },

  previewEmoji: {
    fontSize: 48,
  },

  infoCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 25,
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

  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#26382D",
  },

  infoDescription: {
    fontSize: 13,
    color: "#7B8981",
    marginTop: 3,
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
    fontSize: 17,
    fontWeight: "700",
  },

  activeTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#26382D",
    marginTop: 5,
  },

  cycleText: {
    fontSize: 15,
    color: "#7B8981",
    marginTop: 8,
  },

  breathingArea: {
    height: 300,
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
    fontSize: 30,
    fontWeight: "700",
    color: "#31493A",
    marginTop: 5,
  },

  timerText: {
    fontSize: 54,
    fontWeight: "700",
    color: "#4CAF7D",
    marginTop: 3,
  },

  instructionText: {
    fontSize: 15,
    color: "#718078",
    textAlign: "center",
    marginTop: 5,
  },

  progressContainer: {
    flexDirection: "row",
    marginTop: 25,
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

  completedContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: 45,
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