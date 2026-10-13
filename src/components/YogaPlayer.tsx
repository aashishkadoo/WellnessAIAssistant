// src/components/YogaPlayer.tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AppState,
} from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
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

export default function YogaPlayer({ user, exercise, video, onClose }: Props) {
  const [playing, setPlaying] = useState(false);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  // Pause the timer if the app backgrounds
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (
        appState.current.match(/active/) &&
        next.match(/inactive|background/)
      ) {
        setPlaying(false);
        stopTimer();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), []);

  function startTimer() {
    stopTimer();
    intervalRef.current = setInterval(() => {
      setWatchedSeconds((s) => s + 1);
    }, 1000);
  }

  function stopTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const onStateChange = useCallback((state: string) => {
    if (state === "playing") {
      startTimer();
    } else {
      stopTimer();
    }
    if (state === "ended") {
      handleComplete();
    }
  }, []);

  async function handleComplete() {
    if (saving) return;
    setSaving(true);
    stopTimer();
    setPlaying(false);

    const { error } = await supabase.from("wellness_sessions").insert({
      user_id: user.id,
      exercise_id: exercise.id,
      session_type: exercise.type,
      category: exercise.category,
      duration_seconds: watchedSeconds,
      completed: true,
      completed_at: new Date().toISOString(),
      metadata: {
        youtube_video_id: video.youtube_video_id,
        source: "yoga_player",
      },
    });

    setSaving(false);

    if (error) {
      Alert.alert("Could not save session", error.message);
      return;
    }

    Alert.alert(
      "Namaste 🙏",
      `${exercise.title} logged — ${Math.floor(watchedSeconds / 60)}m ${watchedSeconds % 60}s.`,
      [{ text: "Done", onPress: onClose }]
    );
  }

  const minutes = Math.floor(watchedSeconds / 60);
  const seconds = watchedSeconds % 60;

  return (
    <View style={styles.container}>
      <YoutubePlayer
        height={230}
        play={playing}
        videoId={video.youtube_video_id}
        onChangeState={onStateChange}
      />

      <Text style={styles.title}>{video.title}</Text>
      <Text style={styles.sub}>
        Watched: {minutes}m {String(seconds).padStart(2, "0")}s
      </Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => setPlaying((p) => !p)}
          activeOpacity={0.85}
        >
          <Text style={styles.playTxt}>{playing ? "⏸ Pause" : "▶ Play"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.doneBtn, saving && { opacity: 0.6 }]}
          onPress={handleComplete}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.doneTxt}>
            {saving ? "Saving..." : "✓ Mark Complete"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cancel} onPress={onClose}>
        <Text style={styles.cancelTxt}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#35443B", marginTop: 12 },
  sub: { fontSize: 12, color: "#7A867E", marginTop: 4 },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  playBtn: {
    flex: 1,
    backgroundColor: "#EEF8F1",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  playTxt: { color: "#247A4A", fontWeight: "700" },
  doneBtn: {
    flex: 1,
    backgroundColor: "#247A4A",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  doneTxt: { color: "#FFFFFF", fontWeight: "700" },
  cancel: { alignItems: "center", paddingVertical: 12 },
  cancelTxt: { color: "#7A867E", fontSize: 13 },
});