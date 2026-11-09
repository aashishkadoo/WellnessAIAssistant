// src/components/AIVisionExercise.tsx
import React, { useEffect, useRef, useState } from "react";

import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from "react-native";

import {
  ArrowLeft,
  Eye,
  Sparkles,
  Camera,
  CameraOff,
  Play,
  Pause,
  Square,
  Clock,
  Dumbbell,
  Activity,
  CheckCircle2,
  RotateCcw,
} from "lucide-react-native";

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  user: any;
  onClose: () => void;
};

type ExerciseType = {
  id: string;
  name: string;
  description: string;
  duration: number;
  icon: string;
  instructions: string[];
};

// ============================================================================
// EXERCISES
// ============================================================================

const EXERCISES: ExerciseType[] = [
  {
    id: "pushups",
    name: "Push-ups",
    description: "Strengthen your chest, shoulders and arms.",
    duration: 60,
    icon: "💪",
    instructions: [
      "Position your hands shoulder-width apart.",
      "Keep your body straight.",
      "Lower your chest towards the floor.",
      "Push yourself back up.",
    ],
  },
  {
    id: "squats",
    name: "Squats",
    description: "Build strength in your legs and glutes.",
    duration: 60,
    icon: "🦵",
    instructions: [
      "Stand with your feet shoulder-width apart.",
      "Keep your chest upright.",
      "Bend your knees and lower your hips.",
      "Push through your feet to stand up.",
    ],
  },
  {
    id: "jumping-jacks",
    name: "Jumping Jacks",
    description: "Improve cardiovascular fitness and coordination.",
    duration: 60,
    icon: "🤸",
    instructions: [
      "Stand upright with your feet together.",
      "Jump while spreading your legs.",
      "Raise your arms above your head.",
      "Jump back to your starting position.",
    ],
  },
  {
    id: "plank",
    name: "Plank",
    description: "Strengthen your core and improve stability.",
    duration: 30,
    icon: "🔥",
    instructions: [
      "Place your forearms on the floor.",
      "Extend your legs behind you.",
      "Keep your body in a straight line.",
      "Engage your core and hold the position.",
    ],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function AIVisionExercise({
  user,
  onClose,
}: Props) {
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseType>(EXERCISES[0]);

  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "running" | "paused" | "completed"
  >("idle");

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const remainingSeconds = Math.max(
    selectedExercise.duration - elapsedSeconds,
    0
  );

  const progress = Math.min(
    elapsedSeconds / selectedExercise.duration,
    1
  );

  // ==========================================================================
  // TIMER
  // ==========================================================================

  useEffect(() => {
    if (sessionStatus === "running") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((previous) => {
          const next = previous + 1;

          if (next >= selectedExercise.duration) {
            setSessionStatus("completed");
            return selectedExercise.duration;
          }

          return next;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sessionStatus, selectedExercise.duration]);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remaining
    ).padStart(2, "0")}`;
  };

  const selectExercise = (exercise: ExerciseType) => {
    if (sessionStatus === "running" || sessionStatus === "paused") {
      Alert.alert(
        "Workout in progress",
        "Stop your current workout before selecting another exercise."
      );
      return;
    }

    setSelectedExercise(exercise);
    setElapsedSeconds(0);
    setSessionStatus("idle");
  };

  const startWorkout = () => {
    setSessionStatus("running");
  };

  const pauseWorkout = () => {
    setSessionStatus("paused");
  };

  const resumeWorkout = () => {
    setSessionStatus("running");
  };

  const stopWorkout = () => {
    Alert.alert(
      "Finish workout?",
      "Are you sure you want to end this exercise session?",
      [
        {
          text: "Continue",
          style: "cancel",
        },
        {
          text: "Finish",
          onPress: () => {
            setSessionStatus("completed");
          },
        },
      ]
    );
  };

  const resetWorkout = () => {
    setElapsedSeconds(0);
    setSessionStatus("idle");
  };

  const toggleCamera = () => {
    setCameraEnabled((previous) => !previous);
  };

  // ==========================================================================
  // COMPLETED SESSION
  // ==========================================================================

  if (sessionStatus === "completed") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.backButton}
            accessibilityLabel="Close AI Vision Exercise"
          >
            <ArrowLeft size={22} color="#24382C" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Workout Summary
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={55} color="#247A4A" />
          </View>

          <Text style={styles.summaryTitle}>
            Great Work!
          </Text>

          <Text style={styles.summarySubtitle}>
            You have completed your {selectedExercise.name} session.
          </Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryExerciseIcon}>
              {selectedExercise.icon}
            </Text>

            <Text style={styles.summaryExerciseName}>
              {selectedExercise.name}
            </Text>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Clock size={20} color="#247A4A" />
                <Text style={styles.statValue}>
                  {formatTime(elapsedSeconds)}
                </Text>
                <Text style={styles.statLabel}>
                  Duration
                </Text>
              </View>

              <View style={styles.summaryStat}>
                <Activity size={20} color="#247A4A" />
                <Text style={styles.statValue}>
                  {Math.round(progress * 100)}%
                </Text>
                <Text style={styles.statLabel}>
                  Completed
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={resetWorkout}
          >
            <RotateCcw size={19} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              Start Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onClose}
          >
            <Text style={styles.secondaryButtonText}>
              Back to Exercises
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // MAIN SCREEN
  // ==========================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.backButton}
          accessibilityLabel="Close AI Vision Exercise"
        >
          <ArrowLeft size={22} color="#24382C" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          AI Vision Exercise
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* INTRO */}
        <View style={styles.introSection}>
          <View style={styles.introIcon}>
            <Eye size={27} color="#247A4A" />
            <View style={styles.introSparkle}>
              <Sparkles size={13} color="#C77946" />
            </View>
          </View>

          <View style={styles.introTextContainer}>
            <Text style={styles.title}>
              AI Motion Coach
            </Text>

            <Text style={styles.subtitle}>
              Choose an exercise and start your guided workout.
            </Text>
          </View>
        </View>

        {/* CAMERA PREVIEW */}
        <View style={styles.cameraCard}>
          <View style={styles.cameraPreview}>
            {cameraEnabled ? (
              <View style={styles.cameraPlaceholder}>
                <Camera size={42} color="#A7B7AC" />

                <Text style={styles.cameraTitle}>
                  Camera Preview
                </Text>

                <Text style={styles.cameraDescription}>
                  Camera integration will be added here.
                </Text>
              </View>
            ) : (
              <View style={styles.cameraPlaceholder}>
                <CameraOff size={42} color="#A7B7AC" />

                <Text style={styles.cameraTitle}>
                  Camera Disabled
                </Text>

                <Text style={styles.cameraDescription}>
                  Enable your camera for future AI motion tracking.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cameraFooter}>
            <View style={styles.cameraStatus}>
              <View
                style={[
                  styles.statusDot,
                  cameraEnabled && styles.statusDotActive,
                ]}
              />

              <Text style={styles.cameraStatusText}>
                {cameraEnabled ? "Camera enabled" : "Camera inactive"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.cameraButton}
              onPress={toggleCamera}
            >
              <Camera size={15} color="#247A4A" />

              <Text style={styles.cameraButtonText}>
                {cameraEnabled ? "Disable" : "Enable"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* EXERCISE SELECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Choose Your Exercise
            </Text>

            <Text style={styles.sectionCount}>
              {EXERCISES.length} activities
            </Text>
          </View>

          <View style={styles.exerciseGrid}>
            {EXERCISES.map((exercise) => {
              const selected =
                selectedExercise.id === exercise.id;

              return (
                <TouchableOpacity
                  key={exercise.id}
                  activeOpacity={0.8}
                  onPress={() => selectExercise(exercise)}
                  style={[
                    styles.exerciseCard,
                    selected && styles.exerciseCardSelected,
                  ]}
                >
                  <View style={styles.exerciseCardTop}>
                    <Text style={styles.exerciseEmoji}>
                      {exercise.icon}
                    </Text>

                    {selected && (
                      <CheckCircle2
                        size={18}
                        color="#247A4A"
                      />
                    )}
                  </View>

                  <Text style={styles.exerciseName}>
                    {exercise.name}
                  </Text>

                  <Text style={styles.exerciseDuration}>
                    {exercise.duration} seconds
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SELECTED EXERCISE DETAILS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Exercise Instructions
          </Text>

          <View style={styles.instructionCard}>
            <View style={styles.instructionHeader}>
              <Text style={styles.instructionEmoji}>
                {selectedExercise.icon}
              </Text>

              <View style={styles.instructionTitleContainer}>
                <Text style={styles.instructionTitle}>
                  {selectedExercise.name}
                </Text>

                <Text style={styles.instructionDescription}>
                  {selectedExercise.description}
                </Text>
              </View>
            </View>

            {selectedExercise.instructions.map(
              (instruction, index) => (
                <View
                  key={`${selectedExercise.id}-${index}`}
                  style={styles.instructionRow}
                >
                  <View style={styles.instructionNumber}>
                    <Text style={styles.instructionNumberText}>
                      {index + 1}
                    </Text>
                  </View>

                  <Text style={styles.instructionText}>
                    {instruction}
                  </Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* WORKOUT TIMER */}
        <View style={styles.timerCard}>
          <View style={styles.timerHeader}>
            <View>
              <Text style={styles.timerLabel}>
                WORKOUT TIMER
              </Text>

              <Text style={styles.timerExercise}>
                {selectedExercise.name}
              </Text>
            </View>

            <View style={styles.timerIcon}>
              <Clock size={21} color="#247A4A" />
            </View>
          </View>

          <Text style={styles.timerValue}>
            {formatTime(elapsedSeconds)}
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>

          <View style={styles.timerFooter}>
            <Text style={styles.timerFooterText}>
              {sessionStatus === "running"
                ? "Workout in progress"
                : sessionStatus === "paused"
                ? "Workout paused"
                : "Ready to begin"}
            </Text>

            <Text style={styles.timerFooterText}>
              {formatTime(remainingSeconds)} remaining
            </Text>
          </View>

          <View style={styles.controls}>
            {sessionStatus === "idle" && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={startWorkout}
              >
                <Play size={19} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  Start Workout
                </Text>
              </TouchableOpacity>
            )}

            {sessionStatus === "running" && (
              <>
                <TouchableOpacity
                  style={styles.pauseButton}
                  onPress={pauseWorkout}
                >
                  <Pause size={19} color="#247A4A" />
                  <Text style={styles.pauseButtonText}>
                    Pause
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopWorkout}
                >
                  <Square
                    size={17}
                    color="#FFFFFF"
                    fill="#FFFFFF"
                  />
                  <Text style={styles.primaryButtonText}>
                    Stop
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {sessionStatus === "paused" && (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={resumeWorkout}
                >
                  <Play size={19} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    Resume
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopWorkout}
                >
                  <Square
                    size={17}
                    color="#FFFFFF"
                    fill="#FFFFFF"
                  />
                  <Text style={styles.primaryButtonText}>
                    Stop
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* FUTURE AI FEATURES */}
        <View style={styles.futureCard}>
          <View style={styles.futureIcon}>
            <Sparkles size={20} color="#247A4A" />
          </View>

          <View style={styles.futureTextContainer}>
            <Text style={styles.futureTitle}>
              AI Motion Analysis
            </Text>

            <Text style={styles.futureDescription}>
              Camera-based posture detection, repetition counting
              and real-time exercise feedback will be integrated
              into this module.
            </Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F8F5",
  },

  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#24382C",
  },

  headerSpacer: {
    width: 42,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  introSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  introIcon: {
    width: 57,
    height: 57,
    borderRadius: 19,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  introSparkle: {
    position: "absolute",
    right: 6,
    top: 5,
  },

  introTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 21,
    fontWeight: "900",
    color: "#24382C",
  },

  subtitle: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: "#78867C",
  },

  // CAMERA

  cameraCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 10,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#E8EFEA",
  },

  cameraPreview: {
    height: 190,
    backgroundColor: "#17251D",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  cameraPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
  },

  cameraTitle: {
    marginTop: 13,
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  cameraDescription: {
    marginTop: 6,
    fontSize: 11,
    color: "#A7B7AC",
    textAlign: "center",
    lineHeight: 17,
  },

  cameraFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingTop: 12,
    paddingBottom: 3,
  },

  cameraStatus: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#AAB5AD",
    marginRight: 7,
  },

  statusDotActive: {
    backgroundColor: "#247A4A",
  },

  cameraStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#78867C",
  },

  cameraButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#E6F4EA",
    borderRadius: 10,
    gap: 6,
  },

  cameraButtonText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#247A4A",
  },

  // SECTIONS

  section: {
    marginBottom: 25,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#24382C",
    marginBottom: 13,
  },

  sectionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#849188",
  },

  // EXERCISE GRID

  exerciseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  exerciseCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8EFEA",
    borderRadius: 17,
    padding: 14,
    marginBottom: 12,
  },

  exerciseCardSelected: {
    borderColor: "#247A4A",
    backgroundColor: "#F0F8F2",
  },

  exerciseCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  exerciseEmoji: {
    fontSize: 25,
  },

  exerciseName: {
    fontSize: 13,
    fontWeight: "900",
    color: "#24382C",
  },

  exerciseDuration: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: "600",
    color: "#849188",
  },

  // INSTRUCTIONS

  instructionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8EFEA",
  },

  instructionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  instructionEmoji: {
    fontSize: 29,
    marginRight: 13,
  },

  instructionTitleContainer: {
    flex: 1,
  },

  instructionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#24382C",
  },

  instructionDescription: {
    fontSize: 11,
    color: "#849188",
    marginTop: 4,
  },

  instructionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  instructionNumber: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  instructionNumberText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#247A4A",
  },

  instructionText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#56665B",
  },

  // TIMER

  timerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 19,
    borderWidth: 1,
    borderColor: "#E8EFEA",
    marginBottom: 20,
  },

  timerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  timerLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: "#849188",
  },

  timerExercise: {
    fontSize: 15,
    fontWeight: "900",
    color: "#24382C",
    marginTop: 5,
  },

  timerIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
  },

  timerValue: {
    fontSize: 43,
    fontWeight: "900",
    color: "#247A4A",
    textAlign: "center",
    marginTop: 17,
    marginBottom: 17,
    fontVariant: ["tabular-nums"],
  },

  progressTrack: {
    height: 8,
    backgroundColor: "#EAF0EB",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#247A4A",
    borderRadius: 10,
  },

  timerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  timerFooterText: {
    fontSize: 10,
    color: "#849188",
    fontWeight: "600",
  },

  controls: {
    flexDirection: "row",
    gap: 10,
    marginTop: 21,
  },

  primaryButton: {
    flex: 1,
    minHeight: 51,
    borderRadius: 15,
    backgroundColor: "#247A4A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 15,
  },

  primaryButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  pauseButton: {
    flex: 1,
    minHeight: 51,
    borderRadius: 15,
    backgroundColor: "#E6F4EA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  pauseButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#247A4A",
  },

  stopButton: {
    flex: 1,
    minHeight: 51,
    borderRadius: 15,
    backgroundColor: "#D65B52",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // FUTURE AI

  futureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EAF5ED",
    borderRadius: 17,
    padding: 15,
    marginBottom: 15,
  },

  futureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  futureTextContainer: {
    flex: 1,
  },

  futureTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#247A4A",
  },

  futureDescription: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    color: "#65776A",
  },

  bottomSpacer: {
    height: 25,
  },

  // SUMMARY

  summaryContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },

  successIcon: {
    width: 105,
    height: 105,
    borderRadius: 35,
    backgroundColor: "#E6F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  summaryTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#24382C",
  },

  summarySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#78867C",
    textAlign: "center",
    marginTop: 8,
  },

  summaryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E8EFEA",
  },

  summaryExerciseIcon: {
    fontSize: 35,
  },

  summaryExerciseName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#24382C",
    marginTop: 9,
  },

  summaryDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#EDF1EE",
    marginVertical: 20,
  },

  summaryStats: {
    flexDirection: "row",
    width: "100%",
  },

  summaryStat: {
    flex: 1,
    alignItems: "center",
  },

  statValue: {
    fontSize: 21,
    fontWeight: "900",
    color: "#24382C",
    marginTop: 9,
  },

  statLabel: {
    fontSize: 10,
    color: "#849188",
    marginTop: 4,
  },

  secondaryButton: {
    width: "100%",
    minHeight: 49,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DCE8DF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#247A4A",
  },
});
