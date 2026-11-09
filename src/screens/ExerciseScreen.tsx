// src/screens/ExerciseScreen.tsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Brain,
  CheckCircle2,
  Clock3,
  Compass,
  Dumbbell,
  Headphones,
  Heart,
  Leaf,
  Moon,
  Play,
  Search,
  Sparkles,
  Smartphone,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react-native";

import { supabase } from "../lib/supabase";

import YogaPlayer from "../components/YogaPlayer";
import GuidedSessionPlayer from "../components/GuidedSessionPlayer";
import SensorSessionPlayer from "../components/SensorSessionPlayer";
import AudioPlayer from "../components/AudioPlayer";

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  user: any;
};

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

type ActivePlayer =
  | { kind: "yoga"; exercise: Exercise }
  | { kind: "guided"; exercise: Exercise }
  | { kind: "sensor"; exercise: Exercise }
  | { kind: "audio"; exercise: Exercise }
  | null;

type CategoryConfig = {
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  background: string;
};

// ============================================================================
// THEME
// ============================================================================

const COLORS = {
  background: "#F4F8F5",
  surface: "#FFFFFF",
  primary: "#247A4A",
  primaryDark: "#155D38",
  primaryLight: "#E6F4EA",
  text: "#24382C",
  secondaryText: "#78867C",
  muted: "#A1ADA4",
  border: "#E5EDE7",
  lavender: "#EDE9FF",
  lavenderText: "#7260C4",
  peach: "#FFF0E4",
  peachText: "#C77946",
  blue: "#E6F1FF",
  blueText: "#4F83BE",
};

const CATEGORIES: CategoryConfig[] = [
  {
    name: "All",
    icon: Compass,
    color: COLORS.primary,
    background: COLORS.primaryLight,
  },
  {
    name: "Mental",
    icon: Brain,
    color: COLORS.lavenderText,
    background: COLORS.lavender,
  },
  {
    name: "Relax",
    icon: Waves,
    color: COLORS.blueText,
    background: COLORS.blue,
  },
  {
    name: "Physical",
    icon: Dumbbell,
    color: COLORS.peachText,
    background: COLORS.peach,
  },
  {
    name: "Yoga",
    icon: Activity,
    color: COLORS.primary,
    background: COLORS.primaryLight,
  },
  {
    name: "Music",
    icon: Headphones,
    color: COLORS.lavenderText,
    background: COLORS.lavender,
  },
  {
    name: "Sleep",
    icon: Moon,
    color: COLORS.blueText,
    background: COLORS.blue,
  },
  {
    name: "AI",
    icon: Sparkles,
    color: COLORS.peachText,
    background: COLORS.peach,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function getCategoryConfig(category?: string) {
  return (
    CATEGORIES.find(
      (item) =>
        item.name.toLowerCase() === category?.toLowerCase(),
    ) ?? {
      name: category || "Wellness",
      icon: Leaf,
      color: COLORS.primary,
      background: COLORS.primaryLight,
    }
  );
}

function getExerciseIcon(exercise: Exercise) {
  const value = `${exercise.icon ?? ""} ${exercise.type} ${exercise.category}`
    .toLowerCase();

  if (exercise.sensor) return Smartphone;
  if (value.includes("yoga")) return Activity;
  if (value.includes("music") || value.includes("audio")) {
    return Headphones;
  }
  if (value.includes("sleep")) return Moon;
  if (value.includes("breath") || value.includes("relax")) {
    return Wind;
  }
  if (value.includes("physical") || value.includes("fitness")) {
    return Dumbbell;
  }
  if (value.includes("mental") || value.includes("mind")) {
    return Brain;
  }

  return Leaf;
}

function getExercisePalette(exercise: Exercise) {
  const category = getCategoryConfig(exercise.category);
  return {
    background: category.background,
    foreground: category.color,
  };
}

// ============================================================================
// SCREEN
// ============================================================================

export default function ExerciseScreen({ user }: Props) {
  const insets = useSafeAreaInsets();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [active, setActive] = useState<ActivePlayer>(null);

  // --------------------------------------------------------------------------
  // LOAD EXERCISES
  // --------------------------------------------------------------------------

  const loadExercises = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("exercises")
        .select(`
          id,
          title,
          description,
          category,
          icon,
          duration_minutes,
          difficulty,
          type,
          sensor,
          yoga_videos (
            youtube_video_id,
            title,
            duration_seconds,
            is_active
          ),
          media_items (
            id,
            title,
            artist,
            source_url,
            thumbnail_url,
            duration_seconds,
            loop,
            autoplay,
            media_type,
            is_active
          ),
          exercise_steps ( id )
        `)
        .eq("is_active", true)
        .order("category")
        .order("title");

      if (error) {
        throw error;
      }

      const normalized: Exercise[] = (data ?? []).map(
        (row: any) => {
          const video = Array.isArray(row.yoga_videos)
            ? row.yoga_videos.find(
                (item: any) => item.is_active,
              )
            : null;

          const tracks: AudioTrack[] = Array.isArray(
            row.media_items,
          )
            ? row.media_items
                .filter(
                  (item: any) =>
                    item.is_active &&
                    item.media_type === "audio",
                )
                .map((item: any) => ({
                  id: item.id,
                  title: item.title,
                  artist: item.artist,
                  source_url: item.source_url,
                  thumbnail_url: item.thumbnail_url,
                  duration_seconds: item.duration_seconds,
                  loop: item.loop,
                  autoplay: item.autoplay,
                }))
            : [];

          const hasSteps =
            Array.isArray(row.exercise_steps) &&
            row.exercise_steps.length > 0;

          return {
            id: row.id,
            title: row.title,
            description: row.description ?? "",
            category: row.category ?? "Wellness",
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
        },
      );

      setExercises(normalized);
    } catch (error: any) {
      console.error("[ExerciseScreen] Load failed:", error);

      Alert.alert(
        "Unable to load exercises",
        error?.message ??
          "Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  // --------------------------------------------------------------------------
  // FILTER + SEARCH
  // --------------------------------------------------------------------------

  const filteredExercises = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return exercises.filter((exercise) => {
      const matchesCategory =
        selectedCategory === "All" ||
        exercise.category.toLowerCase() ===
          selectedCategory.toLowerCase();

      const matchesSearch =
        !query ||
        exercise.title.toLowerCase().includes(query) ||
        exercise.description.toLowerCase().includes(query) ||
        exercise.category.toLowerCase().includes(query) ||
        exercise.type.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [exercises, selectedCategory, searchQuery]);

  const featuredExercise = useMemo(
    () =>
      exercises.find(
        (exercise) =>
          exercise.type === "yoga" ||
          exercise.category.toLowerCase() === "relax",
      ) ?? exercises[0],
    [exercises],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: exercises.length,
    };

    for (const exercise of exercises) {
      const matchingCategory = CATEGORIES.find(
        (category) =>
          category.name.toLowerCase() ===
          exercise.category.toLowerCase(),
      );

      if (matchingCategory) {
        counts[matchingCategory.name] =
          (counts[matchingCategory.name] ?? 0) + 1;
      }
    }

    return counts;
  }, [exercises]);

  // --------------------------------------------------------------------------
  // PLAYER ROUTER
  // --------------------------------------------------------------------------

  const startExercise = useCallback((exercise: Exercise) => {
    // Sensor-based exercises take priority.
    if (exercise.sensor) {
      setActive({ kind: "sensor", exercise });
      return;
    }

    if (exercise.type === "yoga" && exercise.yoga_video) {
      setActive({ kind: "yoga", exercise });
      return;
    }

    if ((exercise.audio_tracks?.length ?? 0) > 0) {
      setActive({ kind: "audio", exercise });
      return;
    }

    setActive({ kind: "guided", exercise });
  }, []);

  const closePlayer = useCallback(() => {
    setActive(null);
    // Refresh the catalog in case related data changed during a session.
    // Progress metrics are loaded by their own screen/service.
  }, []);

  // --------------------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background}
        />

        <View style={styles.loadingIcon}>
          <LinearGradient
            colors={["#D9F5E3", "#BCE7CB", "#E8F8ED"]}
            style={StyleSheet.absoluteFill}
          />
          <Activity size={34} color={COLORS.primary} />
        </View>

        <Text style={styles.loadingTitle}>
          Preparing your wellness space
        </Text>

        <Text style={styles.loadingSubtitle}>
          Finding activities for your mind and body...
        </Text>

        <ActivityIndicator
          style={styles.loadingIndicator}
          size="small"
          color={COLORS.primary}
        />
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN UI
  // --------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 10) + 8,
            paddingBottom: 145,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadExercises(true)}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <LinearGradient
              colors={["#3FA56B", "#1D7042"]}
              style={StyleSheet.absoluteFill}
            />
            <Leaf size={22} color="#FFFFFF" />
          </View>

          <View style={styles.brandText}>
            <Text style={styles.eyebrow}>YOUR DAILY RITUAL</Text>
            <Text style={styles.brandTitle}>Wellness space</Text>
          </View>

          <View style={styles.headerBadge}>
            <Sparkles
              size={15}
              color={COLORS.primary}
            />
            <Text style={styles.headerBadgeText}>
              Feel better
            </Text>
          </View>
        </View>

        <View style={styles.headingBlock}>
          <Text style={styles.pageTitle}>
            Move gently.{"\n"}
            <Text style={styles.pageTitleAccent}>
              Feel deeply.
            </Text>
          </Text>

          <Text style={styles.pageSubtitle}>
            A little time for yourself can change your whole day.
          </Text>
        </View>

        {/* FEATURED HERO */}

        {featuredExercise && (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => startExercise(featuredExercise)}
            accessibilityRole="button"
            accessibilityLabel={`Start featured exercise ${featuredExercise.title}`}
          >
            <LinearGradient
              colors={["#267C4B", "#17613A", "#104B30"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroOrbOne} />
              <View style={styles.heroOrbTwo} />

              <View style={styles.heroTopRow}>
                <View style={styles.heroLabel}>
                  <Sparkles size={13} color="#D8F7E2" />
                  <Text style={styles.heroLabelText}>
                    EDITOR'S PICK
                  </Text>
                </View>

                <View style={styles.heroGlassIcon}>
                  <Waves size={20} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.heroArt}>
                <View style={styles.heroRingOuter}>
                  <View style={styles.heroRingInner}>
                    <View style={styles.heroCenter}>
                      {React.createElement(
                        getExerciseIcon(featuredExercise),
                        {
                          size: 38,
                          color: "#FFFFFF",
                          strokeWidth: 1.7,
                        },
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.heroFloatingDot} />
                <View style={styles.heroFloatingDotSmall} />
              </View>

              <Text style={styles.heroKicker}>
                A MOMENT JUST FOR YOU
              </Text>

              <Text style={styles.heroTitle}>
                {featuredExercise.title}
              </Text>

              <Text
                style={styles.heroDescription}
                numberOfLines={2}
              >
                {featuredExercise.description ||
                  "Pause, recharge, and reconnect with yourself."}
              </Text>

              <View style={styles.heroBottomRow}>
                <View style={styles.heroMeta}>
                  <Clock3 size={15} color="#D5EEDF" />
                  <Text style={styles.heroMetaText}>
                    {featuredExercise.duration_minutes != null
                      ? `${featuredExercise.duration_minutes} min`
                      : "Your own pace"}
                  </Text>
                </View>

                <View style={styles.heroPlayButton}>
                  <Text style={styles.heroPlayText}>
                    Start session
                  </Text>
                  <ArrowRight
                    size={17}
                    color={COLORS.primaryDark}
                  />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* SMALL STATS STRIP */}

        <View style={styles.introStrip}>
          <View style={styles.introIcon}>
            <Heart size={18} color="#D97777" />
          </View>

          <View style={styles.introTextWrap}>
            <Text style={styles.introTitle}>
              Your wellbeing, your pace
            </Text>
            <Text style={styles.introSubtitle}>
              No pressure. Just progress, one session at a time.
            </Text>
          </View>

          <View style={styles.introSparkle}>
            <Sparkles size={17} color="#C7A45C" />
          </View>
        </View>

        {/* SECTION HEADING */}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>
              Explore activities
            </Text>
            <Text style={styles.sectionSubtitle}>
              Find what feels right today
            </Text>
          </View>

          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {filteredExercises.length} activities
            </Text>
          </View>
        </View>

        {/* SEARCH */}

        <View style={styles.searchBox}>
          <Search size={19} color={COLORS.muted} />

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search yoga, breathing, sleep..."
            placeholderTextColor="#9AA79E"
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search wellness activities"
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearSearch}
              accessibilityLabel="Clear search"
            >
              <X size={16} color={COLORS.secondaryText} />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORY FILTERS */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const selected =
              selectedCategory === category.name;

            return (
              <TouchableOpacity
                key={category.name}
                activeOpacity={0.82}
                onPress={() =>
                  setSelectedCategory(category.name)
                }
                style={[
                  styles.categoryChip,
                  selected && styles.categoryChipActive,
                ]}
              >
                <Icon
                  size={15}
                  color={
                    selected ? "#FFFFFF" : category.color
                  }
                  strokeWidth={2.1}
                />

                <Text
                  style={[
                    styles.categoryChipText,
                    selected && styles.categoryChipTextActive,
                  ]}
                >
                  {category.name}
                </Text>

                {categoryCounts[category.name] > 0 && (
                  <Text
                    style={[
                      styles.categoryCount,
                      selected && styles.categoryCountActive,
                    ]}
                  >
                    {categoryCounts[category.name]}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* EXERCISE CARDS */}

        <View style={styles.exerciseList}>
          {filteredExercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIllustration}>
                {searchQuery ? (
                  <Search size={32} color={COLORS.primary} />
                ) : (
                  <Leaf size={34} color={COLORS.primary} />
                )}
              </View>

              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? "Nothing found just yet"
                  : "A little quiet here"}
              </Text>

              <Text style={styles.emptyDescription}>
                {searchQuery
                  ? "Try another keyword or choose a different category."
                  : "There are no activities in this category yet."}
              </Text>

              {(searchQuery.length > 0 ||
                selectedCategory !== "All") && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                  style={styles.resetButton}
                >
                  <Text style={styles.resetButtonText}>
                    Show all activities
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredExercises.map((exercise, index) => {
              const Icon = getExerciseIcon(exercise);
              const palette = getExercisePalette(exercise);

              const trackCount =
                exercise.audio_tracks?.length ?? 0;

              const isSensor = Boolean(exercise.sensor);
              const isVideo = Boolean(exercise.yoga_video);
              const isAudio = trackCount > 0;

              let modeLabel = "Guided session";
              let modeIcon = CheckCircle2;

              if (isSensor) {
                modeLabel = "Sensor experience";
                modeIcon = Smartphone;
              } else if (
                exercise.type === "yoga" &&
                isVideo
              ) {
                modeLabel = "Video practice";
                modeIcon = Play;
              } else if (isAudio) {
                modeLabel = `${trackCount} audio ${
                  trackCount === 1 ? "track" : "tracks"
                }`;
                modeIcon = AudioLines;
              }

              const ModeIcon = modeIcon;

              return (
                <TouchableOpacity
                  key={exercise.id}
                  activeOpacity={0.88}
                  onPress={() => startExercise(exercise)}
                  style={styles.exerciseCard}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${exercise.title}`}
                >
                  <View style={styles.cardMainRow}>
                    <View
                      style={[
                        styles.exerciseIconTile,
                        { backgroundColor: palette.background },
                      ]}
                    >
                      <View style={styles.iconHighlight} />
                      <Icon
                        size={27}
                        color={palette.foreground}
                        strokeWidth={1.8}
                      />
                    </View>

                    <View style={styles.exerciseInfo}>
                      <View style={styles.cardEyebrowRow}>
                        <Text
                          style={[
                            styles.cardCategory,
                            { color: palette.foreground },
                          ]}
                        >
                          {exercise.category.toUpperCase()}
                        </Text>

                        {index === 0 && (
                          <View style={styles.topPickBadge}>
                            <Sparkles
                              size={10}
                              color="#B78A34"
                            />
                            <Text style={styles.topPickText}>
                              PICK
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text
                        style={styles.exerciseTitle}
                        numberOfLines={2}
                      >
                        {exercise.title}
                      </Text>

                      <Text
                        style={styles.exerciseDescription}
                        numberOfLines={2}
                      >
                        {exercise.description ||
                          "Take a moment to recharge and reconnect."}
                      </Text>
                    </View>

                    <View style={styles.cardArrow}>
                      <ArrowRight
                        size={17}
                        color={COLORS.primary}
                      />
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardFooter}>
                    <View style={styles.cardMetadata}>
                      <Clock3
                        size={13}
                        color={COLORS.secondaryText}
                      />

                      <Text style={styles.cardMetadataText}>
                        {exercise.duration_minutes != null
                          ? `${exercise.duration_minutes} min`
                          : "Flexible duration"}
                      </Text>

                      {exercise.difficulty ? (
                        <>
                          <View style={styles.metaDot} />
                          <Text
                            style={styles.cardMetadataText}
                            numberOfLines={1}
                          >
                            {exercise.difficulty}
                          </Text>
                        </>
                      ) : null}
                    </View>

                    <View style={styles.modeBadge}>
                      <ModeIcon
                        size={12}
                        color={COLORS.primary}
                      />
                      <Text
                        style={styles.modeBadgeText}
                        numberOfLines={1}
                      >
                        {modeLabel}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* BOTTOM ENCOURAGEMENT */}

        {filteredExercises.length > 0 && (
          <View style={styles.encouragement}>
            <View style={styles.encouragementIcon}>
              <Heart size={18} color={COLORS.primary} />
            </View>

            <View style={styles.encouragementText}>
              <Text style={styles.encouragementTitle}>
                Small steps still count.
              </Text>
              <Text style={styles.encouragementSubtitle}>
                Choose an activity and make today yours.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* PLAYER MODAL */}

      <Modal
        visible={active !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closePlayer}
        statusBarTranslucent
      >
        {active !== null && (
          <View style={styles.playerContainer}>
            {active.kind === "yoga" &&
              active.exercise.yoga_video && (
                <YogaPlayer
                  user={user}
                  exercise={{
                    id: active.exercise.id,
                    title: active.exercise.title,
                    category: active.exercise.category,
                    type: active.exercise.type,
                  }}
                  video={active.exercise.yoga_video}
                  onClose={closePlayer}
                />
              )}

            {active.kind === "guided" && (
              <GuidedSessionPlayer
                user={user}
                exercise={{
                  id: active.exercise.id,
                  title: active.exercise.title,
                  category: active.exercise.category,
                  type: active.exercise.type,
                }}
                onClose={(_completed) => closePlayer()}
              />
            )}

            {active.kind === "sensor" && (
              <SensorSessionPlayer
                user={user}
                exercise={{
                  id: active.exercise.id,
                  title: active.exercise.title,
                  category: active.exercise.category,
                  type: active.exercise.type,
                  sensor: active.exercise.sensor,
                }}
                onClose={(_completed) => closePlayer()}
              />
            )}

            {active.kind === "audio" && (
              <AudioPlayer
                user={user}
                exercise={{
                  id: active.exercise.id,
                  title: active.exercise.title,
                  category: active.exercise.category,
                  type: active.exercise.type,
                }}
                tracks={active.exercise.audio_tracks ?? []}
                onClose={(_completed) => closePlayer()}
              />
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

// ============================================================================
// STYLES — SOFT 3D / GLASS-INSPIRED WELLNESS UI
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  // Loading

  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 88,
    height: 88,
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    elevation: 8,
    shadowColor: "#286C43",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },

  loadingTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  loadingSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.secondaryText,
    textAlign: "center",
    lineHeight: 20,
  },

  loadingIndicator: {
    marginTop: 22,
  },

  // Header

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 27,
  },

  brandMark: {
    width: 47,
    height: 47,
    borderRadius: 17,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    elevation: 5,
    shadowColor: "#1D7042",
    shadowOpacity: 0.17,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },

  brandText: {
    flex: 1,
    marginLeft: 12,
  },

  eyebrow: {
    color: COLORS.secondaryText,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
  },

  brandTitle: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.4,
  },

  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  headerBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },

  // Heading

  headingBlock: {
    marginBottom: 22,
  },

  pageTitle: {
    fontSize: 35,
    lineHeight: 41,
    fontWeight: "900",
    letterSpacing: -1.4,
    color: COLORS.text,
  },

  pageTitleAccent: {
    color: COLORS.primary,
  },

  pageSubtitle: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.secondaryText,
    maxWidth: 310,
  },

  // Hero card

  heroCard: {
    borderRadius: 29,
    overflow: "hidden",
    padding: 21,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    elevation: 10,
    shadowColor: "#164B2E",
    shadowOpacity: 0.23,
    shadowRadius: 19,
    shadowOffset: { width: 0, height: 10 },
  },

  heroOrbOne: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -75,
    top: -78,
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  heroOrbTwo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -45,
    top: -38,
    backgroundColor: "rgba(185,240,203,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  heroLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },

  heroLabelText: {
    color: "#E3F6E9",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  heroGlassIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },

  heroArt: {
    height: 132,
    alignItems: "center",
    justifyContent: "center",
  },

  heroRingOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(230,255,237,0.3)",
    backgroundColor: "rgba(255,255,255,0.045)",
  },

  heroRingInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.11)",
  },

  heroCenter: {
    width: 64,
    height: 64,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(221,250,230,0.19)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  heroFloatingDot: {
    position: "absolute",
    top: 20,
    right: "23%",
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#B8EDC8",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },

  heroFloatingDotSmall: {
    position: "absolute",
    bottom: 19,
    left: "25%",
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F4E5A8",
  },

  heroKicker: {
    color: "#C7EBD2",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginTop: 3,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 7,
  },

  heroDescription: {
    color: "#D5EEDF",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },

  heroBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 19,
  },

  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  heroMetaText: {
    color: "#E0F4E6",
    fontSize: 12,
    fontWeight: "600",
  },

  heroPlayButton: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#F0FAF2",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  heroPlayText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },

  // Intro strip

  introStrip: {
    minHeight: 77,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    marginBottom: 28,
    elevation: 3,
    shadowColor: "#234D34",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  introIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FFF0EF",
    alignItems: "center",
    justifyContent: "center",
  },

  introTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  introTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },

  introSubtitle: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 15,
    color: COLORS.secondaryText,
  },

  introSparkle: {
    width: 31,
    height: 31,
    borderRadius: 12,
    backgroundColor: "#FFF7E4",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
  },

  // Section heading

  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.6,
    color: COLORS.text,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 5,
  },

  countPill: {
    backgroundColor: "#E6F3E9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },

  countPillText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
  },

  // Search

  searchBox: {
    minHeight: 53,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#E5EDE7",
    marginBottom: 16,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: COLORS.text,
    fontSize: 12,
  },

  clearSearch: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  // Categories

  categoryList: {
    paddingBottom: 19,
    paddingRight: 10,
    gap: 9,
  },

  categoryChip: {
    minHeight: 41,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EEE9",
  },

  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
  },

  categoryChipText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },

  categoryChipTextActive: {
    color: "#FFFFFF",
  },

  categoryCount: {
    fontSize: 9,
    color: COLORS.secondaryText,
    fontWeight: "800",
  },

  categoryCountActive: {
    color: "#D8F1E0",
  },

  // Exercise cards

  exerciseList: {
    gap: 13,
  },

  exerciseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 23,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E8EFE9",
    elevation: 3,
    shadowColor: "#234D34",
    shadowOpacity: 0.055,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
  },

  cardMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  exerciseIconTile: {
    width: 63,
    height: 67,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },

  iconHighlight: {
    position: "absolute",
    width: 39,
    height: 20,
    top: -7,
    right: -6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.48)",
    transform: [{ rotate: "-30deg" }],
  },

  exerciseInfo: {
    flex: 1,
    minWidth: 0,
  },

  cardEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 5,
  },

  cardCategory: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.15,
  },

  topPickBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#FFF4D8",
  },

  topPickText: {
    color: "#A77C28",
    fontSize: 8,
    fontWeight: "900",
  },

  exerciseTitle: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  exerciseDescription: {
    marginTop: 5,
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 17,
  },

  cardArrow: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#EFF7F1",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
  },

  cardDivider: {
    height: 1,
    backgroundColor: "#EDF1ED",
    marginTop: 14,
    marginBottom: 12,
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 9,
  },

  cardMetadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },

  cardMetadataText: {
    color: COLORS.secondaryText,
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 1,
  },

  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#B7C2BA",
  },

  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "55%",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#EDF7F0",
  },

  modeBadgeText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: "800",
    flexShrink: 1,
  },

  // Empty state

  emptyCard: {
    alignItems: "center",
    paddingHorizontal: 27,
    paddingVertical: 38,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyIllustration: {
    width: 75,
    height: 75,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyDescription: {
    marginTop: 8,
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },

  resetButton: {
    marginTop: 19,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 14,
  },

  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  // Encouragement

  encouragement: {
    marginTop: 22,
    marginBottom: 5,
    padding: 15,
    borderRadius: 21,
    backgroundColor: "#E8F4EA",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  encouragementIcon: {
    width: 41,
    height: 41,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  encouragementText: {
    flex: 1,
  },

  encouragementTitle: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },

  encouragementSubtitle: {
    marginTop: 4,
    color: "#688471",
    fontSize: 10,
    lineHeight: 15,
  },

  playerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
