// src/components/GuidedSessionPlayer.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import Tts from "react-native-tts";
import { supabase } from "../lib/supabase";
import BreathingVisualizer from "./BreathingVisualizer";

type Step = {
  id: string;
  step_order: number;
  title: string;
  instruction: string;
  duration_seconds: number;
  animation_key: string | null;
  voice_prompt: string | null;
};

type Props = {
  user: any;
  exercise: { id: string; title: string; category: string; type: string };
  onClose: () => void;
  onCompleted?: () => void;
};

export default function GuidedSessionPlayer({
  user,
  exercise,
  onClose,
  onCompleted,
}: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const finished = useRef(false);

  // -------- Initialize TTS once --------
  useEffect(() => {
    Tts.setDefaultRate(0.9);
    Tts.setDefaultPitch(1.0);
    // Optional: silence errors if the device has no TTS engine
    Tts.addEventListener("tts-error", () => {});
    return () => {
      Tts.stop();
      Tts.removeAllListeners("tts-error");
    };
  }, []);

  // -------- Load steps --------
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("exercise_steps")
        .select("*")
        .eq("exercise_id", exercise.id)
        .order("step_order");

      if (error || !data?.length) {
        Alert.alert("No guided steps available yet for this exercise.");
        onClose();
        return;
      }
      setSteps(data as Step[]);
      setRemaining(data[0].duration_seconds);
      setLoading(false);
    })();
  }, [exercise.id]);

  // -------- Countdown --------
  useEffect(() => {
    if (loading || paused || steps.length === 0) return;

    const t = setInterval(() => {
      setElapsed((e) => e + 1);
      setRemaining((r) => {
        if (r > 1) return r - 1;
        setCurrentIndex((idx) => {
          const next = idx + 1;
          if (next >= steps.length) {
            if (!finished.current) {
              finished.current = true;
              completeSession();
            }
            return idx;
          }
          setRemaining(steps[next].duration_seconds);
          speak(steps[next].voice_prompt ?? steps[next].title);
          return next;
        });
        return 0;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [loading, paused, steps, currentIndex]);

  // -------- Speak first step when loaded --------
  useEffect(() => {
    if (steps.length > 0 && currentIndex === 0) {
      speak(steps[0].voice_prompt ?? steps[0].title);
    }
  }, [steps]);

  function speak(text: string | null) {
    if (!text) return;
    Tts.stop();
    Tts.speak(text);
  }

  async function completeSession() {
    Tts.stop();
    const { error } = await supabase.from("wellness_sessions").insert({
      user_id: user.id,
      exercise_id: exercise.id,
      session_type: exercise.type,
      category: exercise.category,
      duration_seconds: elapsed,
      completed: true,
      completed_at: new Date().toISOString(),
      metadata: { source: "guided_player", steps_completed: steps.length },
    });

    if (error) {
      Alert.alert("Could not save session", error.message);
    } else {
      Alert.alert("Well done 🌿", `${exercise.title} completed.`, [
        {
          text: "Done",
          onPress: () => {
            onCompleted?.();
            onClose();
          },
        },
      ]);
    }
  }

  if (loading || steps.length === 0) {
    return (
      <View style={styles.center}>
        <Text>Loading session…</Text>
      </View>
    );
  }

  const step = steps[currentIndex];
  const phase = (step.animation_key as any) ?? "focus";
  const progress =
    elapsed / steps.reduce((s, x) => s + x.duration_seconds, 0);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            Tts.stop();
            onClose();
          }}
        >
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{exercise.title}</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${progress * 100}%` }]}
        />
      </View>

      <BreathingVisualizer
        phase={phase}
        durationSeconds={step.duration_seconds}
        label={step.title}
      />

      <Text style={styles.instruction}>{step.instruction}</Text>
      <Text style={styles.countdown}>{remaining}s</Text>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => setPaused((p) => !p)}
        >
          <Text style={styles.ctrlTxt}>{paused ? "▶ Resume" : "⏸ Pause"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, styles.ctrlBtnPrimary]}
          onPress={completeSession}
        >
          <Text style={[styles.ctrlTxt, { color: "#fff" }]}>✓ Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAF7", paddingTop: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  close: { fontSize: 24, color: "#247A4A", width: 30 },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#35443B",
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#E7EFEA",
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: "#247A4A" },
  instruction: {
    textAlign: "center",
    fontSize: 16,
    color: "#35443B",
    lineHeight: 24,
    paddingHorizontal: 30,
    marginTop: 8,
  },
  countdown: {
    textAlign: "center",
    fontSize: 44,
    fontWeight: "800",
    color: "#247A4A",
    marginTop: 12,
  },
  controls: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 30,
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
  },
  ctrlBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0EAE3",
  },
  ctrlBtnPrimary: { backgroundColor: "#247A4A", borderColor: "#247A4A" },
  ctrlTxt: { fontSize: 15, fontWeight: "700", color: "#247A4A" },
});