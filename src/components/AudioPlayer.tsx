// src/components/AudioPlayer.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import Sound from "react-native-sound";
import { supabase } from "../lib/supabase";

// Enable playback in silent mode on iOS
Sound.setCategory("Playback");

type Track = {
  id: string;
  title: string;
  artist: string | null;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  loop: boolean | null;
  autoplay: boolean | null;
};

type Props = {
  user: any;
  exercise: { id: string; title: string; category: string; type: string };
  tracks: Track[];
  onClose: (completed: boolean) => void;
};

export default function AudioPlayer({ user, exercise, tracks, onClose }: Props) {
  const soundRef = useRef<Sound | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = tracks[index];

  // Create session row
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("wellness_sessions")
        .insert({
          user_id: user.id,
          exercise_id: exercise.id,
          session_type: "music",
          category: exercise.category,
          completed: false,
          metadata: { source: "audio_player" },
        })
        .select()
        .single();
      if (data) setSessionId(data.id);
    })();

    return () => {
      soundRef.current?.release();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Load current track
  useEffect(() => {
    if (!current) return;
    let cancelled = false;

    soundRef.current?.release();

    const sound = new Sound(current.source_url, "", (error) => {
      if (cancelled) return;
      if (error) {
        Alert.alert("Playback error", "Couldn't load the audio.");
        return;
      }
      setDuration(sound.getDuration());
      if (current.autoplay ?? true) {
        sound.play((success) => {
          if (!success) return;
          // Track finished
          if (index < tracks.length - 1) setIndex((i) => i + 1);
          else finishSession(true);
        });
        setPlaying(true);
      }
    });
    sound.setNumberOfLoops(current.loop ? -1 : 0);
    soundRef.current = sound;

    timerRef.current = setInterval(() => {
      sound.getCurrentTime((seconds) => setPosition(seconds));
    }, 500);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      sound.release();
    };
  }, [current?.id]);

  async function togglePlay() {
    const s = soundRef.current;
    if (!s) return;
    if (playing) {
      s.pause();
      setPlaying(false);
    } else {
      s.play((success) => {
        if (success) {
          if (index < tracks.length - 1) setIndex((i) => i + 1);
          else finishSession(true);
        }
      });
      setPlaying(true);
    }
  }

  async function next() {
    if (index < tracks.length - 1) setIndex((i) => i + 1);
    else finishSession(true);
  }

  async function prev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  async function finishSession(completed: boolean) {
    soundRef.current?.pause();
    const elapsed = Math.round(position);

    if (sessionId) {
      await supabase
        .from("wellness_sessions")
        .update({
          completed,
          duration_seconds: elapsed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", sessionId);
    }

    if (completed) {
      await supabase.from("daily_activities").insert({
        user_id: user.id,
        activity_type: exercise.category ?? "Music",
        duration_minutes: Math.max(1, Math.round(elapsed / 60)),
        completed: true,
      });
    }

    onClose(completed);
  }

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (!current) {
    return (
      <View style={styles.root}>
        <Text style={styles.empty}>No tracks available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => finishSession(false)}>
          <Text style={styles.exit}>✕ Exit</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {exercise.title}
        </Text>
        <Text style={styles.counter}>
          {index + 1}/{tracks.length}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.art} />
        <Text style={styles.title}>{current.title}</Text>
        {current.artist ? <Text style={styles.artist}>{current.artist}</Text> : null}

        <View style={styles.seekTrack}>
          <View
            style={[
              styles.seekFill,
              { width: duration ? `${(position / duration) * 100}%` : "0%" },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.time}>{fmt(position)}</Text>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={prev} style={styles.ctrlSmall}>
            <Text style={styles.ctrlSmallText}>⏮</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay} style={styles.ctrlBig}>
            <Text style={styles.ctrlBigText}>{playing ? "⏸" : "▶"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={next} style={styles.ctrlSmall}>
            <Text style={styles.ctrlSmallText}>⏭</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.finish}
          onPress={() => finishSession(true)}
        >
          <Text style={styles.finishText}>Finish session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5FAF7" },
  empty: { textAlign: "center", marginTop: 60, color: "#8A958E" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EFEA",
  },
  exit: { color: "#B02B2B", fontWeight: "700" },
  headerTitle: { flex: 1, textAlign: "center", fontWeight: "800", color: "#304138" },
  counter: { color: "#8A958E", fontWeight: "700" },
  body: { flex: 1, padding: 24, alignItems: "center" },
  art: { width: 220, height: 220, borderRadius: 28, backgroundColor: "#247A4A", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "800", color: "#247A4A", textAlign: "center" },
  artist: { marginTop: 6, color: "#7A867E" },
  seekTrack: { height: 4, width: "100%", backgroundColor: "#E1ECE5", borderRadius: 2, marginTop: 30 },
  seekFill: { height: 4, backgroundColor: "#247A4A", borderRadius: 2 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 6 },
  time: { fontSize: 12, color: "#8A958E" },
  controls: { flexDirection: "row", alignItems: "center", marginTop: 30, gap: 24 },
  ctrlSmall: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFF",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E1ECE5",
  },
  ctrlSmallText: { fontSize: 22 },
  ctrlBig: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#247A4A", alignItems: "center", justifyContent: "center" },
  ctrlBigText: { fontSize: 34, color: "#fff" },
  finish: {
    marginTop: 32, backgroundColor: "#EAF6EE", paddingVertical: 14,
    paddingHorizontal: 28, borderRadius: 18, borderWidth: 1, borderColor: "#C7E3D5",
  },
  finishText: { color: "#247A4A", fontWeight: "800" },
});