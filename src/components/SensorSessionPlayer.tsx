// src/components/SensorSessionPlayer.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from "react-native";
import {
  accelerometer,
  setUpdateIntervalForType,
  SensorTypes,
} from "react-native-sensors";
import { map } from "rxjs/operators";
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

async function ensureSensorPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (Number(Platform.Version) < 29) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      {
        title: "Motion access",
        message: "We need motion access to count your reps.",
        buttonPositive: "Allow",
        buttonNegative: "Deny",
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export default function SensorSessionPlayer({ user, exercise, onClose }: Props) {
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "denied">("loading");

  const lastPeak = useRef(0);
  const smooth = useRef(1);
  const lastMag = useRef(1);

  // Permission + session row
  useEffect(() => {
    (async () => {
      const ok = await ensureSensorPermission();
      if (!ok) {
        setStatus("denied");
        Alert.alert("Motion permission needed", "Enable in Settings.");
        return;
      }
      const { data } = await supabase
        .from("wellness_sessions")
        .insert({
          user_id: user.id,
          exercise_id: exercise.id,
          session_type: exercise.type,
          category: exercise.category,
          completed: false,
          metadata: { source: "sensor_player", sensor: exercise.sensor },
        })
        .select()
        .single();
      if (data) setSessionId(data.id);
      setStatus("ready");
      setRunning(true);
    })();
  }, []);

  // Timer
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Accelerometer subscription
  useEffect(() => {
    if (status !== "ready" || !running) return;

    setUpdateIntervalForType(SensorTypes.accelerometer, 80);

    const sub = accelerometer
      .pipe(
        map(({ x, y, z }) => {
          const raw = Math.sqrt(x * x + y * y + z * z);
          const alpha = 0.3;
          smooth.current = alpha * raw + (1 - alpha) * smooth.current;
          return smooth.current;
        })
      )
      .subscribe((mag) => {
        const delta = Math.abs(mag - lastMag.current);
        const now = Date.now();
        if (delta > 0.45 && now - lastPeak.current > 800) {
          lastPeak.current = now;
          setReps((r) => r + 1);
        }
        lastMag.current = mag;
      });

    return () => sub.unsubscribe();
  }, [status, running]);

  async function finish() {
    setRunning(false);
    if (sessionId) {
      await supabase
        .from("wellness_sessions")
        .update({
          completed: true,
          duration_seconds: elapsed,
          completed_at: new Date().toISOString(),
          metadata: { source: "sensor_player", sensor: exercise.sensor, reps },
        })
        .eq("id", sessionId);
    }
    await supabase.from("daily_activities").insert({
      user_id: user.id,
      activity_type: exercise.category ?? "Movement",
      duration_minutes: Math.max(1, Math.round(elapsed / 60)),
      completed: true,
    });
    Alert.alert("Session saved 💪", `${reps} reps in ${formatTime(elapsed)}.`, [
      { text: "Done", onPress: () => onClose(true) },
    ]);
  }

  function cancel() {
    Alert.alert("Exit session?", "Progress won't be saved.", [
      { text: "Keep going", style: "cancel" },
      { text: "Exit", style: "destructive", onPress: () => onClose(false) },
    ]);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  }

  if (status === "loading") {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#247A4A" />
        <Text style={styles.loadingText}>Preparing sensors…</Text>
      </View>
    );
  }

  if (status === "denied") {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.unavailableIcon}>📱</Text>
        <Text style={styles.unavailableTitle}>Motion access denied</Text>
        <Text style={styles.unavailableText}>
          Enable motion access in Settings to track this exercise.
        </Text>
        <TouchableOpacity style={styles.exitBtn} onPress={() => onClose(false)}>
          <Text style={styles.exitBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={cancel} style={styles.headerSide}>
          <Text style={styles.exit}>✕ Exit</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{exercise.title}</Text>
        <Text style={styles.headerSide} />
      </View>

      <View style={styles.liveRow}>
        <View style={[styles.liveDot, { backgroundColor: running ? "#22C55E" : "#F59E0B" }]} />
        <Text style={styles.liveText}>{running ? "Tracking live" : "Paused"}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.counterCircle}>
          <Text style={styles.counterValue}>{reps}</Text>
          <Text style={styles.counterLabel}>reps</Text>
        </View>

        <View style={styles.timerPill}>
          <Text style={styles.timerIcon}>⏱</Text>
          <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
        </View>

        <Text style={styles.hint}>
          Hold your phone in your hand and move naturally.
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.pauseBtn} onPress={() => setRunning((r) => !r)}>
          <Text style={styles.pauseText}>{running ? "⏸ Pause" : "▶ Resume"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.finishBtn} onPress={finish}>
          <Text style={styles.finishText}>✓ Finish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5FAF7" },
  center: { alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#7A867E" },
  unavailableIcon: { fontSize: 48, marginBottom: 12 },
  unavailableTitle: { fontSize: 20, fontWeight: "800", color: "#247A4A" },
  unavailableText: {
    marginTop: 8, fontSize: 14, color: "#7A867E",
    textAlign: "center", paddingHorizontal: 40, lineHeight: 20,
  },
  exitBtn: {
    marginTop: 24, backgroundColor: "#247A4A", paddingVertical: 14,
    paddingHorizontal: 32, borderRadius: 18,
  },
  exitBtnText: { color: "#fff", fontWeight: "800" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E7EFEA",
  },
  headerSide: { width: 60 },
  exit: { color: "#B02B2B", fontWeight: "700" },
  headerTitle: { flex: 1, textAlign: "center", fontWeight: "800", color: "#304138" },
  liveRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 12, color: "#7A867E", fontWeight: "600", textTransform: "uppercase" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  counterCircle: {
    width: 240, height: 240, borderRadius: 120, backgroundColor: "#247A4A",
    alignItems: "center", justifyContent: "center",
    elevation: 10, shadowColor: "#247A4A", shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
  },
  counterValue: { color: "#FFFFFF", fontSize: 84, fontWeight: "900" },
  counterLabel: { color: "#B8E0CB", fontSize: 16, textTransform: "uppercase", letterSpacing: 3 },
  timerPill: {
    flexDirection: "row", alignItems: "center", marginTop: 28,
    backgroundColor: "#FFF", paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: "#E1ECE5", gap: 8,
  },
  timerIcon: { fontSize: 16 },
  timerText: { fontSize: 20, fontWeight: "800", color: "#247A4A" },
  hint: { marginTop: 22, fontSize: 13, color: "#7A867E", textAlign: "center", lineHeight: 20 },
  controls: { flexDirection: "row", padding: 16, paddingBottom: 32, gap: 12 },
  pauseBtn: {
    flex: 1, backgroundColor: "#FFF", paddingVertical: 16, borderRadius: 18,
    alignItems: "center", borderWidth: 1, borderColor: "#E1ECE5",
  },
  pauseText: { fontWeight: "800", color: "#247A4A" },
  finishBtn: { flex: 1, backgroundColor: "#247A4A", paddingVertical: 16, borderRadius: 18, alignItems: "center" },
  finishText: { fontWeight: "800", color: "#FFFFFF" },
});