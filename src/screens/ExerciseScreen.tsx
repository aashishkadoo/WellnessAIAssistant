// src/screens/ExerciseScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

import YogaPlayer from "../components/YogaPlayer";
import GuidedSessionPlayer from "../components/GuidedSessionPlayer";
import SensorSessionPlayer from "../components/SensorSessionPlayer";
import AudioPlayer from "../components/AudioPlayer";

type Props = { user: any };

type AudioTrack = {
  id: string;
  title: string;
  artist: string | null;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  loop: boolean | null;
  autoplay: boolean | null;
};

type Exercise = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string | null;
  duration_minutes: number | null;
  difficulty: string | null;
  type: string;
  sensor: string | null;
  yoga_video?: {
    youtube_video_id: string;
    title: string;
    duration_seconds: number | null;
  } | null;
  audio_tracks?: AudioTrack[];
  has_steps?: boolean;
};

const CATEGORIES = [
  "All",
  "Mental",
  "Relax",
  "Physical",
  "Yoga",
  "Music",
  "Sleep",
  "AI",
];

// Single source of truth for what modal is open
type ActivePlayer =
  | { kind: "yoga"; exercise: Exercise }
  | { kind: "guided"; exercise: Exercise }
  | { kind: "sensor"; exercise: Exercise }
  | { kind: "audio"; exercise: Exercise }
  | null;

export default function ExerciseScreen({ user }: Props) {
  const insets = useSafeAreaInsets();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [active, setActive] = useState<ActivePlayer>(null);

  // =====================================================
  // LOAD EXERCISES (with all related media in one query)
  // =====================================================
  async function loadExercises() {
    const { data, error } = await supabase
      .from("exercises")
      .select(
        `
        id, title, description, category, icon,
        duration_minutes, difficulty, type, sensor,
        yoga_videos ( youtube_video_id, title, duration_seconds, is_active ),
        media_items ( id, title, artist, source_url, thumbnail_url,
                      duration_seconds, loop, autoplay, media_type, is_active ),
        exercise_steps ( id )
      `
      )
      .eq("is_active", true)
      .order("category")
      .order("title");

    if (error) {
      Alert.alert("Failed to load exercises", error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const normalized: Exercise[] = (data ?? []).map((row: any) => {
      const video = Array.isArray(row.yoga_videos)
        ? row.yoga_videos.find((v: any) => v.is_active)
        : null;

      const tracks: AudioTrack[] = Array.isArray(row.media_items)
        ? row.media_items
            .filter((m: any) => m.is_active && m.media_type === "audio")
            .map((m: any) => ({
              id: m.id,
              title: m.title,
              artist: m.artist,
              source_url: m.source_url,
              thumbnail_url: m.thumbnail_url,
              duration_seconds: m.duration_seconds,
              loop: m.loop,
              autoplay: m.autoplay,
            }))
        : [];

      const hasSteps =
        Array.isArray(row.exercise_steps) && row.exercise_steps.length > 0;

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        icon: row.icon,
        duration_minutes: row.duration_minutes,
        difficulty: row.difficulty,
        type: row.type,
        sensor: row.sensor,
        yoga_video: video
          ? {
              youtube_video_id: video.youtube_video_id,
              title: video.title,
              duration_seconds: video.duration_seconds,
            }
          : null,
        audio_tracks: tracks,
        has_steps: hasSteps,
      };
    });

    setExercises(normalized);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadExercises();
  }, []);

  // =====================================================
  // FILTER
  // =====================================================
  const filteredExercises = useMemo(() => {
    if (selectedCategory === "All") return exercises;
    return exercises.filter((e) => e.category === selectedCategory);
  }, [selectedCategory, exercises]);

  // =====================================================
  // ROUTER — pick the right player for this exercise
  // =====================================================
  function startExercise(exercise: Exercise) {
    // 1. Sensor takes priority — it's the most specific flow
    if (exercise.sensor) {
      setActive({ kind: "sensor", exercise });
      return;
    }

    // 2. Yoga video
    if (exercise.type === "yoga" && exercise.yoga_video) {
      setActive({ kind: "yoga", exercise });
      return;
    }

    // 3. Music / audio tracks
    if ((exercise.audio_tracks?.length ?? 0) > 0) {
      setActive({ kind: "audio", exercise });
      return;
    }

    // 4. Default: guided player (works with or without steps)
    setActive({ kind: "guided", exercise });
  }

  // =====================================================
  // UI
  // =====================================================
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#247A4A" />
        <Text style={styles.loadingTxt}>Loading exercises…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Wellness Exercises 🌿</Text>
        <Text style={styles.subtitle}>Take care of your mind and body.</Text>
      </View>

      {/* CATEGORIES */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
          nestedScrollEnabled
        >
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  isActive && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* LIST */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.exerciseList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadExercises();
            }}
            tintColor="#247A4A"
            colors={["#247A4A"]}
          />
        }
      >
        {filteredExercises.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🌱</Text>
            <Text style={styles.emptyTxt}>
              No exercises in this category yet.
            </Text>
          </View>
        )}

        {filteredExercises.map((exercise) => (
          <TouchableOpacity
            key={exercise.id}
            style={styles.exerciseCard}
            activeOpacity={0.85}
            onPress={() => startExercise(exercise)}
          >
            <View style={styles.iconContainer}>
              <Text style={styles.exerciseIcon}>{exercise.icon ?? "🌿"}</Text>
            </View>

            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseTitle}>{exercise.title}</Text>

              <Text style={styles.exerciseDescription} numberOfLines={2}>
                {exercise.description}
              </Text>

              <View style={styles.metadata}>
                {exercise.duration_minutes != null && (
                  <Text style={styles.metadataText}>
                    ⏱ {exercise.duration_minutes} min
                  </Text>
                )}
                {exercise.difficulty && (
                  <Text style={styles.metadataText}>
                    • {exercise.difficulty}
                  </Text>
                )}
                {exercise.sensor && (
                  <Text style={styles.sensorText}>• 📱 Sensor</Text>
                )}
                {exercise.yoga_video && (
                  <Text style={styles.videoBadge}>• ▶ Video</Text>
                )}
                {(exercise.audio_tracks?.length ?? 0) > 0 && (
                  <Text style={styles.audioBadge}>
                    • 🎵 {exercise.audio_tracks!.length} track
                    {exercise.audio_tracks!.length > 1 ? "s" : ""}
                  </Text>
                )}
                {exercise.has_steps && !exercise.yoga_video && (
                  <Text style={styles.stepsBadge}>• 📋 Guided</Text>
                )}
              </View>
            </View>

            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* ==============================================
          PLAYER MODAL — one active at a time
      ============================================== */}
      <Modal
        visible={active !== null}
        animationType="slide"
        onRequestClose={() => setActive(null)}
        statusBarTranslucent
      >
        {active?.kind === "yoga" && active.exercise.yoga_video && (
          <YogaPlayer
            user={user}
            exercise={{
              id: active.exercise.id,
              title: active.exercise.title,
              category: active.exercise.category,
              type: active.exercise.type,
            }}
            video={active.exercise.yoga_video}
            onClose={() => setActive(null)}
          />
        )}

        {active?.kind === "guided" && (
          <GuidedSessionPlayer
            user={user}
            exercise={{
              id: active.exercise.id,
              title: active.exercise.title,
              category: active.exercise.category,
              type: active.exercise.type,
            }}
            onClose={(completed) => setActive(null)}
          />
        )}

        {active?.kind === "sensor" && (
          <SensorSessionPlayer
            user={user}
            exercise={{
              id: active.exercise.id,
              title: active.exercise.title,
              category: active.exercise.category,
              type: active.exercise.type,
              sensor: active.exercise.sensor,
            }}
            onClose={(completed) => setActive(null)}
          />
        )}

        {active?.kind === "audio" && (
          <AudioPlayer
            user={user}
            exercise={{
              id: active.exercise.id,
              title: active.exercise.title,
              category: active.exercise.category,
              type: active.exercise.type,
            }}
            tracks={active.exercise.audio_tracks ?? []}
            onClose={(completed) => setActive(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// =====================================================
// STYLES
// =====================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAF7" },
  center: { justifyContent: "center", alignItems: "center" },
  loadingTxt: { marginTop: 12, color: "#7A867E" },

  header: { paddingHorizontal: 22, paddingBottom: 12 },
  title: { fontSize: 27, fontWeight: "800", color: "#247A4A" },
  subtitle: { marginTop: 6, fontSize: 14, color: "#748078" },

  categorySection: { height: 60, width: "100%", justifyContent: "center" },
  categoryContainer: {
    paddingHorizontal: 18,
    alignItems: "center",
    paddingVertical: 8,
  },
  categoryButton: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    marginRight: 9,
    borderWidth: 1,
    borderColor: "#E0EAE3",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryButtonActive: {
    backgroundColor: "#247A4A",
    borderColor: "#247A4A",
    elevation: 2,
  },
  categoryText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#68756D",
    fontWeight: "600",
  },
  categoryTextActive: { color: "#FFFFFF", fontWeight: "700" },

  exerciseList: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 140, // room for tab bar + FAB
  },
  empty: { padding: 40, alignItems: "center" },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyTxt: { color: "#8A958E", fontSize: 14 },

  exerciseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7EFEA",
    elevation: 2,
  },
  iconContainer: {
    width: 55,
    height: 55,
    borderRadius: 17,
    backgroundColor: "#EEF8F1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  exerciseIcon: { fontSize: 27 },
  exerciseInfo: { flex: 1, minWidth: 0 },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#35443B",
    marginBottom: 4,
  },
  exerciseDescription: { fontSize: 12, lineHeight: 17, color: "#7A867E" },
  metadata: {
    flexDirection: "row",
    marginTop: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  metadataText: { fontSize: 11, color: "#8A958E", marginRight: 7 },
  sensorText: { fontSize: 11, color: "#4CAF7D", fontWeight: "600" },
  videoBadge: { fontSize: 11, color: "#247A4A", fontWeight: "700" },
  audioBadge: { fontSize: 11, color: "#247A4A", fontWeight: "700" },
  stepsBadge: { fontSize: 11, color: "#247A4A", fontWeight: "700" },
  arrow: { fontSize: 28, color: "#A2ADA6", marginLeft: 8 },
  bottomSpace: { height: 40 },
});