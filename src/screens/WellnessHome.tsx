//src/screens/WellnessHome.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  StatusBar,
  Image,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Heart,
  Leaf,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Wind,
  Zap,
  Smile,
  CalendarDays,
} from "lucide-react-native";

import { supabase } from "../lib/supabase";

import {
  getCurrentProfile,
  UserProfile,
} from "../services/profileService";

import { moodService } from "../services/moodService";

import {
  fetchWellnessMetrics,
  fetchFeaturedExercises,
  WellnessMetrics,
} from "../services/wellnessMetricsService";

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  user: any;
  onOpenBreathing?: () => void;
  onOpenExercise?: (exercise: any) => void;
  onOpenProgress?: () => void;
  onOpenMood?: () => void;
  onOpenProfile?: () => void;
  bottomOffset?: number;
};

type IconComponent = React.ComponentType<any>;

type MoodItem = {
  emoji: string;
  label: string;
  color: string;
};

// ============================================================================
// THEME
// ============================================================================

const C = {
  background: "#F7FBF8",
  white: "#FFFFFF",
  whiteSoft: "#FCFEFC",

  green: "#2BBE68",
  greenDark: "#16864A",
  greenDeep: "#116B3B",
  greenLight: "#E8F8ED",
  greenPale: "#F0FBF3",
  neon: "#72E99A",
  neonBright: "#A3F6B9",

  text: "#172B20",
  textSecondary: "#405A49",
  muted: "#819187",
  mutedLight: "#A8B5AC",

  border: "#E6EEE8",
  borderGreen: "#CDEED7",

  blue: "#5C9FE8",
  purple: "#9A80D8",
  orange: "#E9A747",
  red: "#E66B6B",

  shadow: "#183D27",
};

const MOODS: MoodItem[] = [
  { emoji: "😢", label: "Low", color: "#7597E8" },
  { emoji: "😕", label: "Meh", color: "#9C91D9" },
  { emoji: "😐", label: "Okay", color: "#D9A743" },
  { emoji: "🙂", label: "Good", color: "#49BD78" },
  { emoji: "😄", label: "Great", color: "#20B968" },
];

// ============================================================================
// HELPERS
// ============================================================================

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Number(minutes) || 0);

  if (safeMinutes < 60) {
    return `${safeMinutes} min`;
  }

  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function getDisplayName(
  profile: UserProfile | null,
  user: any
): string {
  const fullName = profile?.full_name?.trim();

  if (fullName) {
    return fullName.split(/\s+/)[0];
  }

  const email = profile?.email ?? user?.email ?? "";

  if (email.includes("@")) {
    const prefix = email.split("@")[0];

    const readableName = prefix
      .replace(/[._-]+/g, " ")
      .trim()
      .split(/\s+/)
      .map((part: string) =>
        part.charAt(0).toUpperCase() + part.slice(1)
      )
      .join(" ");

    return readableName || "there";
  }

  return "there";
}

function getProfileAvatarSource(
  profile: UserProfile | null
): { uri: string } | null {
  if (!profile) return null;

  if (profile.avatar_local_data?.trim()) {
    const localData = profile.avatar_local_data.trim();

    return {
      uri: localData.startsWith("data:")
        ? localData
        : `data:image/jpeg;base64,${localData}`,
    };
  }

  if (profile.avatar_url?.trim()) {
    return { uri: profile.avatar_url.trim() };
  }

  return null;
}

function getWellnessInsight(metrics: WellnessMetrics) {
  const {
    todayMood,
    todayActivities,
    weeklyStats,
    recentSessions,
  } = metrics;

  if (todayActivities.completed > 0) {
    return {
      title: "You're building momentum",
      message: `You've completed ${todayActivities.completed} ${
        todayActivities.completed === 1
          ? "activity"
          : "activities"
      } today. Every small action counts.`,
      icon: Flame,
    };
  }

  if (todayMood?.mood && todayMood.mood <= 2) {
    return {
      title: "Take it gently today",
      message:
        "A little breathing or gentle movement could be a good place to start.",
      icon: Heart,
    };
  }

  if (weeklyStats.streakDays >= 3) {
    return {
      title: "Consistency looks good on you",
      message: `You're on a ${weeklyStats.streakDays}-day streak. Keep showing up for yourself.`,
      icon: Zap,
    };
  }

  if (weeklyStats.totalMinutes > 0) {
    return {
      title: "Your effort is adding up",
      message: `You've invested ${formatMinutes(
        weeklyStats.totalMinutes
      )} in your wellbeing this week.`,
      icon: Sparkles,
    };
  }

  if (recentSessions.length > 0) {
    return {
      title: "Welcome back",
      message:
        "Your previous sessions are here. Ready to continue your wellness journey?",
      icon: Leaf,
    };
  }

  return {
    title: "Your next chapter starts here",
    message:
      "Try a short breathing session or exercise. Small steps can make a difference.",
    icon: Sparkles,
  };
}

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[styles.glassCard, style]}>
      {children}
    </View>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>

        {!!subtitle && (
          <Text style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      {!!action && !!onAction && (
        <TouchableOpacity
          style={styles.sectionAction}
          onPress={onAction}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionActionText}>
            {action}
          </Text>
          <ChevronRight size={16} color={C.green} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  accent,
  background,
}: {
  icon: IconComponent;
  value: string | number;
  label: string;
  accent: string;
  background: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View
        style={[
          styles.metricIcon,
          { backgroundColor: background },
        ]}
      >
        <Icon size={19} color={accent} strokeWidth={2.1} />
      </View>

      <Text style={styles.metricValue}>{value}</Text>

      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// ============================================================================
// SCREEN
// ============================================================================

export default function WellnessHome({
  user,
  onOpenBreathing,
  onOpenExercise,
  onOpenProgress,
  onOpenMood,
  onOpenProfile,
  bottomOffset = 88,
}: Props) {
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [metrics, setMetrics] = useState<WellnessMetrics | null>(null);
  const [featured, setFeatured] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingMood, setLoggingMood] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  const loadAll = useCallback(async () => {
    const userId = user?.id;

    if (!userId) {
      setLoadError("Your account could not be identified.");
      setLoading(false);
      return;
    }

    setLoadError(null);

    const results = await Promise.allSettled([
      getCurrentProfile(),
      fetchWellnessMetrics(userId),
      fetchFeaturedExercises(4),
    ]);

    const [profileResult, metricsResult, featuredResult] = results;

    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value ?? null);
    } else {
      console.warn(
        "Profile loading failed:",
        profileResult.reason
      );
    }

    if (metricsResult.status === "fulfilled") {
      setMetrics(metricsResult.value);
    } else {
      console.error(
        "Wellness metrics loading failed:",
        metricsResult.reason
      );

      setLoadError(
        "We couldn't load your wellness insights. Please try again."
      );
    }

    if (featuredResult.status === "fulfilled") {
      setFeatured(featuredResult.value ?? []);
    } else {
      console.warn(
        "Featured exercises loading failed:",
        featuredResult.reason
      );
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    const initialise = async () => {
      setLoading(true);

      try {
        await loadAll();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initialise();

    return () => {
      active = false;
    };
  }, [loadAll]);

  // ==========================================================================
  // REFRESH
  // ==========================================================================

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  // ==========================================================================
  // MOOD LOGGING
  // ==========================================================================

  const handleQuickMood = useCallback(
    async (moodValue: number) => {
      if (!user?.id || loggingMood) return;

      try {
        setLoggingMood(true);

        await moodService.logMood({
          user_id: user.id,
          mood: moodValue,
          energy: 3,
          stress: 3,
          note: "Quick log from Home",
        });

        await loadAll();

        Alert.alert(
          "Mood recorded",
          "Thanks for checking in with yourself."
        );
      } catch (error: any) {
        Alert.alert(
          "Couldn't save mood",
          error?.message ?? "Please try again."
        );
      } finally {
        setLoggingMood(false);
      }
    },
    [user?.id, loggingMood, loadAll]
  );

  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  const logout = () => {
    Alert.alert(
      "Log out?",
      "You can sign back in anytime.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.auth.signOut();

            if (error) {
              Alert.alert("Logout failed", error.message);
            }
          },
        },
      ]
    );
  };

  // ==========================================================================
  // DERIVED DATA
  // ==========================================================================

  const displayName = useMemo(
    () => getDisplayName(profile, user),
    [profile, user]
  );

  const avatarSource = getProfileAvatarSource(profile);

  const avatarInitial = (
    profile?.full_name ??
    profile?.email ??
    user?.email ??
    "U"
  )
    .toString()
    .charAt(0)
    .toUpperCase();

  const insight = metrics
    ? getWellnessInsight(metrics)
    : null;

  const InsightIcon = insight?.icon ?? Sparkles;

  const todayMood = metrics?.todayMood;
  const todayActivities = metrics?.todayActivities;
  const weeklyStats = metrics?.weeklyStats;
  const recentSessions = metrics?.recentSessions ?? [];

  const progress =
    todayActivities && todayActivities.total > 0
      ? Math.min(
          todayActivities.completed / todayActivities.total,
          1
        )
      : 0;

  const selectedMood =
    todayMood?.mood &&
    todayMood.mood >= 1 &&
    todayMood.mood <= 5
      ? MOODS[todayMood.mood - 1]
      : null;

  // ==========================================================================
  // LOADING
  // ==========================================================================

  if (loading && !metrics) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={C.background}
        />

        <View style={styles.loadingGlow}>
          <LinearGradient
            colors={["#B5F4C7", "#E8F9ED", "#FFFFFF"]}
            style={styles.loadingOrb}
          >
            <Leaf size={35} color={C.green} />
          </LinearGradient>
        </View>

        <ActivityIndicator
          size="small"
          color={C.green}
          style={{ marginTop: 25 }}
        />

        <Text style={styles.loadingTitle}>
          Preparing your wellness space
        </Text>

        <Text style={styles.loadingSubtitle}>
          Your journey, your pace.
        </Text>
      </View>
    );
  }

  // ==========================================================================
  // ERROR
  // ==========================================================================

  if (!metrics) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={C.background}
        />

        <View style={styles.errorIcon}>
          <RefreshCw size={27} color={C.green} />
        </View>

        <Text style={styles.errorTitle}>
          Let's reconnect
        </Text>

        <Text style={styles.errorMessage}>
          {loadError ??
            "Your wellness information is temporarily unavailable."}
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={async () => {
            setLoading(true);

            try {
              await loadAll();
            } finally {
              setLoading(false);
            }
          }}
          activeOpacity={0.8}
        >
          <RefreshCw size={17} color={C.white} />
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.background}
      />

      {/* Soft ambient green background accents */}
      <View
        pointerEvents="none"
        style={styles.backgroundGlowOne}
      />
      <View
        pointerEvents="none"
        style={styles.backgroundGlowTwo}
      />
      <View
        pointerEvents="none"
        style={styles.backgroundGlowThree}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 10,
            paddingBottom:
              Math.max(insets.bottom, 12) +
              Math.max(bottomOffset, 88) +
              20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.green}
            colors={[C.green]}
          />
        }
      >
        {/* ==================================================================
            HEADER
        ================================================================== */}

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.brandRow}>
              <LinearGradient
                colors={["#D4F7DE", "#EAF9EF"]}
                style={styles.brandIcon}
              >
                <Leaf size={14} color={C.greenDark} />
              </LinearGradient>

              <Text style={styles.brandText}>
                WELLNESS AI
              </Text>

              <View style={styles.brandSeparator} />

              <View style={styles.liveIndicator} />

              <Text style={styles.liveText}>
                YOUR SPACE
              </Text>
            </View>

            <Text style={styles.greeting}>
              {getGreeting()},
            </Text>

            <Text
              style={styles.userName}
              numberOfLines={1}
            >
              {displayName}
              <Text style={styles.nameAccent}>.</Text>
            </Text>

            <Text style={styles.headerSubtitle}>
              Make today a little better than yesterday.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={onOpenProfile}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <View style={styles.avatarAura} />

            <View style={styles.avatar}>
              {avatarSource ? (
                <Image
                  key={avatarSource.uri}
                  source={avatarSource}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={(event) =>
                    console.warn(
                      "Home profile picture failed:",
                      event.nativeEvent.error
                    )
                  }
                />
              ) : (
                <LinearGradient
                  colors={["#63DB8C", "#209A54"]}
                  style={styles.avatarFallback}
                >
                  <Text style={styles.avatarText}>
                    {avatarInitial}
                  </Text>
                </LinearGradient>
              )}
            </View>

            <View style={styles.avatarOnline} />
          </TouchableOpacity>
        </View>

        {/* ==================================================================
            WELLNESS INSIGHT
        ================================================================== */}

        <View style={styles.insightOuter}>
          <View style={styles.insightAura} />

          <LinearGradient
            colors={["#E2F9E9", "#F2FCF4", "#FFFFFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.insightCard}
          >
            <View style={styles.insightGlowCircle} />

            <View style={styles.insightTop}>
              <View style={styles.insightLabel}>
                <Sparkles size={14} color={C.greenDark} />
                <Text style={styles.insightLabelText}>
                  YOUR WELLNESS INSIGHT
                </Text>
              </View>

              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>
                  PERSONAL INSIGHT
                </Text>
              </View>
            </View>

            <View style={styles.insightMain}>
              <View style={styles.insightIcon}>
                <InsightIcon
                  size={25}
                  color={C.greenDark}
                  strokeWidth={1.9}
                />
              </View>

              <View style={styles.insightCopy}>
                <Text style={styles.insightTitle}>
                  {insight?.title}
                </Text>

                <Text style={styles.insightMessage}>
                  {insight?.message}
                </Text>
              </View>
            </View>

            <View style={styles.insightBottom}>
              <View style={styles.insightBottomLeft}>
                <View style={styles.insightPulse} />

                <Text style={styles.insightBottomText}>
                  Based on your wellness activity
                </Text>
              </View>

              <TouchableOpacity
                onPress={onOpenProgress}
                activeOpacity={0.75}
                style={styles.insightArrow}
              >
                <ArrowUpRight
                  size={19}
                  color={C.white}
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ==================================================================
            MOOD CHECK-IN
        ================================================================== */}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>
              How are you feeling?
            </Text>

            <Text style={styles.sectionSubtitle}>
              Your daily check-in matters.
            </Text>
          </View>

          <View style={styles.todayTag}>
            <CalendarDays size={12} color={C.greenDark} />
            <Text style={styles.todayTagText}>
              TODAY
            </Text>
          </View>
        </View>

        <GlassCard style={styles.moodCard}>
          <View style={styles.moodHeader}>
            <View style={styles.moodHeaderIcon}>
              <Heart size={19} color={C.green} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.moodTitle}>
                Mood check-in
              </Text>

              <Text style={styles.moodSubtitle}>
                No judgement. Just check in.
              </Text>
            </View>

            {selectedMood && (
              <View style={styles.selectedMoodBadge}>
                <Text style={{ fontSize: 22 }}>
                  {selectedMood.emoji}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.moodRow}>
            {MOODS.map((item, index) => {
              const value = index + 1;
              const selected = todayMood?.mood === value;

              return (
                <TouchableOpacity
                  key={item.label}
                  disabled={loggingMood}
                  onPress={() => handleQuickMood(value)}
                  activeOpacity={0.7}
                  style={[
                    styles.moodOption,
                    selected && styles.moodOptionSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Log mood: ${item.label}`}
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[
                      styles.moodEmojiCircle,
                      selected && {
                        borderColor: item.color,
                        backgroundColor: `${item.color}18`,
                      },
                    ]}
                  >
                    <Text style={styles.moodEmoji}>
                      {item.emoji}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.moodOptionLabel,
                      selected && { color: item.color },
                    ]}
                  >
                    {item.label}
                  </Text>

                  {selected && (
                    <View
                      style={[
                        styles.moodSelectedDot,
                        { backgroundColor: item.color },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.moodFooter}>
            {loggingMood ? (
              <ActivityIndicator
                size="small"
                color={C.green}
              />
            ) : (
              <View style={styles.smallNeonDot} />
            )}

            <Text style={styles.moodFooterText}>
              {loggingMood
                ? "Recording your check-in..."
                : todayMood
                  ? `Recorded today · Energy ${todayMood.energy ?? "—"} · Stress ${todayMood.stress ?? "—"}`
                  : "Select an emoji to record your mood"}
            </Text>
          </View>
        </GlassCard>

        {/* ==================================================================
            WEEKLY OVERVIEW
        ================================================================== */}

        <SectionHeading
          title="Your activity"
          subtitle="A snapshot of your wellness journey."
          action="Details"
          onAction={onOpenProgress}
        />

        <View style={styles.metricsRow}>
          <MetricCard
            icon={Flame}
            value={weeklyStats.streakDays}
            label="Day streak"
            accent={C.green}
            background="#E8F8ED"
          />

          <MetricCard
            icon={Clock3}
            value={weeklyStats.totalMinutes}
            label="Minutes"
            accent={C.blue}
            background="#EDF5FF"
          />

          <MetricCard
            icon={Smile}
            value={weeklyStats.avgMood ?? "—"}
            label="Avg. mood"
            accent={C.orange}
            background="#FFF6E7"
          />
        </View>

        {/* ==================================================================
            DAILY PROGRESS
        ================================================================== */}

        <GlassCard style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View style={styles.progressHeaderLeft}>
              <View style={styles.progressIcon}>
                <Target size={20} color={C.green} />
              </View>

              <View>
                <Text style={styles.cardTitle}>
                  Today's progress
                </Text>

                <Text style={styles.cardSubtitle}>
                  Every step is a win.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onOpenProgress}
              style={styles.progressArrow}
              activeOpacity={0.7}
            >
              <ChevronRight size={19} color={C.green} />
            </TouchableOpacity>
          </View>

          <View style={styles.progressNumberRow}>
            <View>
              <Text style={styles.progressNumber}>
                {todayActivities.totalMinutes}
                <Text style={styles.progressUnit}>
                  {" "}min
                </Text>
              </Text>

              <Text style={styles.progressCaption}>
                Time invested today
              </Text>
            </View>

            <View style={styles.progressCountBadge}>
              <Text style={styles.progressCountValue}>
                {todayActivities.completed}/{todayActivities.total}
              </Text>

              <Text style={styles.progressCountLabel}>
                ACTIVITIES
              </Text>
            </View>
          </View>

          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(progress * 100),
            }}
          >
            <LinearGradient
              colors={["#A3F5B8", "#51D982", "#20B968"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>

          <View style={styles.progressFooter}>
            <View style={styles.progressLegend}>
              <CheckCircle2
                size={15}
                color={C.green}
              />

              <Text style={styles.progressLegendText}>
                {todayActivities.completed > 0
                  ? "You're making progress. Keep going!"
                  : "Your next small step starts here."}
              </Text>
            </View>

            <Text style={styles.progressPercentage}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        </GlassCard>

        {/* ==================================================================
            QUICK START
        ================================================================== */}

        <View style={styles.quickStartHeading}>
          <View>
            <Text style={styles.sectionTitle}>
              Ready to reset?
            </Text>

            <Text style={styles.sectionSubtitle}>
              Your next wellness moment is one tap away.
            </Text>
          </View>

          <View style={styles.quickHeadingIcon}>
            <Zap size={19} color={C.green} />
          </View>
        </View>

        <View style={styles.quickStartRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (featured.length > 0) {
                onOpenExercise?.(featured[0]);
              } else {
                onOpenBreathing?.();
              }
            }}
            style={styles.quickStartMain}
          >
            <LinearGradient
              colors={["#B7F4C8", "#7EE6A0", "#53D783"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickStartGradient}
            >
              <View style={styles.quickStartGlow} />

              <View style={styles.quickStartIcon}>
                <Activity size={24} color={C.greenDeep} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.quickStartEyebrow}>
                  QUICK START
                </Text>

                <Text style={styles.quickStartTitle}>
                  Start exercising
                </Text>

                <Text style={styles.quickStartSubtitle}>
                  Move. Breathe. Recharge.
                </Text>
              </View>

              <View style={styles.quickStartArrow}>
                <ArrowUpRight
                  size={20}
                  color={C.white}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onOpenBreathing}
            style={styles.breathingShortcut}
          >
            <View style={styles.breathingIcon}>
              <Wind size={23} color={C.green} />
            </View>

            <Text style={styles.breathingTitle}>
              Breathe
            </Text>

            <Text style={styles.breathingCaption}>
              Find your calm
            </Text>

            <ChevronRight
              size={16}
              color={C.green}
              style={{ marginTop: 8 }}
            />
          </TouchableOpacity>
        </View>

        {/* ==================================================================
            FEATURED EXERCISES
        ================================================================== */}

        {featured.length > 0 && (
          <>
            <SectionHeading
              title="Made for your journey"
              subtitle="Explore your available exercises."
              action="Progress"
              onAction={onOpenProgress}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exerciseCarousel}
            >
              {featured.map((exercise, index) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseCard}
                  onPress={() => onOpenExercise?.(exercise)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${exercise.title}`}
                >
                  <LinearGradient
                    colors={
                      index % 2 === 0
                        ? ["#E0F8E8", "#CFF1D9"]
                        : ["#E5F2FF", "#D6E9FC"]
                    }
                    style={styles.exerciseCardTop}
                  >
                    <View style={styles.exerciseCardGlow} />

                    <Text style={styles.exerciseEmoji}>
                      {exercise.icon ?? "🧘"}
                    </Text>

                    <View style={styles.exerciseDuration}>
                      <Clock3
                        size={11}
                        color={C.greenDark}
                      />

                      <Text style={styles.exerciseDurationText}>
                        {exercise.duration_minutes
                          ? `${exercise.duration_minutes} min`
                          : "Exercise"}
                      </Text>
                    </View>
                  </LinearGradient>

                  <View style={styles.exerciseCardBody}>
                    <Text
                      style={styles.exerciseTitle}
                      numberOfLines={1}
                    >
                      {exercise.title}
                    </Text>

                    <Text
                      style={styles.exerciseMeta}
                      numberOfLines={1}
                    >
                      {exercise.category ?? "Wellness"}
                      {exercise.difficulty
                        ? ` · ${exercise.difficulty}`
                        : ""}
                    </Text>

                    <View style={styles.exerciseOpenRow}>
                      <Text style={styles.exerciseOpenText}>
                        Explore
                      </Text>

                      <ArrowUpRight
                        size={15}
                        color={C.green}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ==================================================================
            RECENT SESSIONS
        ================================================================== */}

        <SectionHeading
          title="Recent sessions"
          subtitle="Your latest wellness activities."
          action="See all"
          onAction={onOpenProgress}
        />

        <GlassCard style={styles.sessionsCard}>
          {recentSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Sparkles size={25} color={C.green} />
              </View>

              <Text style={styles.emptyTitle}>
                Your journey starts here
              </Text>

              <Text style={styles.emptyText}>
                Complete your first wellness session and it will appear here.
              </Text>

              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => {
                  if (featured[0]) {
                    onOpenExercise?.(featured[0]);
                  } else {
                    onOpenBreathing?.();
                  }
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.emptyActionText}>
                  Start your first session
                </Text>

                <ArrowUpRight
                  size={15}
                  color={C.green}
                />
              </TouchableOpacity>
            </View>
          ) : (
            recentSessions.map((session, index) => (
              <View
                key={session.id}
                style={[
                  styles.sessionRow,
                  index === recentSessions.length - 1 &&
                    styles.noBorder,
                ]}
              >
                <View style={styles.sessionIcon}>
                  <Text style={styles.sessionEmoji}>
                    {session.icon ?? "🧘"}
                  </Text>
                </View>

                <View style={styles.sessionCopy}>
                  <Text
                    style={styles.sessionTitle}
                    numberOfLines={1}
                  >
                    {session.title}
                  </Text>

                  <Text style={styles.sessionMeta}>
                    {new Date(
                      session.started_at
                    ).toLocaleDateString()}
                    {" · "}
                    {Math.round(
                      (session.duration_seconds ?? 0) / 60
                    )}{" "}
                    min
                  </Text>
                </View>

                <View
                  style={[
                    styles.sessionStatus,
                    session.completed
                      ? styles.sessionDone
                      : styles.sessionPending,
                  ]}
                >
                  <View
                    style={[
                      styles.sessionStatusDot,
                      {
                        backgroundColor: session.completed
                          ? C.green
                          : C.orange,
                      },
                    ]}
                  />

                  <Text
                    style={[
                      styles.sessionStatusText,
                      {
                        color: session.completed
                          ? C.greenDark
                          : C.orange,
                      },
                    ]}
                  >
                    {session.completed ? "Done" : "Active"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </GlassCard>

        {/* ==================================================================
            ACCOUNT
        ================================================================== */}

        <SectionHeading
          title="Your account"
          subtitle="Your personal wellness profile."
        />

        <GlassCard style={styles.accountCard}>
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Mail size={17} color={C.green} />
            </View>

            <View style={styles.accountCopy}>
              <Text style={styles.accountLabel}>
                EMAIL ADDRESS
              </Text>

              <Text
                style={styles.accountValue}
                numberOfLines={1}
              >
                {profile?.email ??
                  user?.email ??
                  "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.accountRow}>
            <View style={styles.accountIconPurple}>
              <Target size={17} color={C.purple} />
            </View>

            <View style={styles.accountCopy}>
              <Text style={styles.accountLabel}>
                WELLNESS GOAL
              </Text>

              <Text
                style={styles.accountValue}
                numberOfLines={2}
              >
                {profile?.wellness_goal ??
                  "No wellness goal set yet"}
              </Text>
            </View>
          </View>

          {!!onOpenProfile && (
            <>
              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.manageProfile}
                onPress={onOpenProfile}
                activeOpacity={0.75}
              >
                <UserRound
                  size={17}
                  color={C.green}
                />

                <Text style={styles.manageProfileText}>
                  Manage profile
                </Text>

                <ChevronRight
                  size={17}
                  color={C.green}
                />
              </TouchableOpacity>
            </>
          )}
        </GlassCard>

        {/* ==================================================================
            LOGOUT
        ================================================================== */}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          activeOpacity={0.8}
        >
          <LogOut size={17} color={C.red} />
          <Text style={styles.logoutText}>
            Log out
          </Text>
        </TouchableOpacity>

        {/* ==================================================================
            BRAND FOOTER
        ================================================================== */}

        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <LinearGradient
              colors={["#D6F6E0", "#EBF9EF"]}
              style={styles.footerLogo}
            >
              <Leaf size={15} color={C.greenDark} />
            </LinearGradient>

            <Text style={styles.footerBrandText}>
              WELLNESS
              <Text style={{ color: C.green }}> AI</Text>
            </Text>
          </View>

          <Text style={styles.footerTagline}>
            A healthier mind. A stronger you.
          </Text>

          <View style={styles.footerDivider} />

          <Text style={styles.developedBy}>
            DEVELOPED BY
          </Text>

          <Text style={styles.developerName}>
            Aashish Kadoo
          </Text>

          <View style={styles.footerCopyrightRow}>
            <ShieldCheck
              size={12}
              color={C.mutedLight}
            />

            <Text style={styles.footerCopyright}>
              Personal wellness, powered by technology.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },

  // Background accents

  backgroundGlowOne: {
    position: "absolute",
    top: 50,
    right: -115,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(90, 221, 132, 0.09)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    top: 560,
    left: -145,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(87, 207, 128, 0.065)",
  },

  backgroundGlowThree: {
    position: "absolute",
    bottom: 120,
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(127, 230, 158, 0.07)",
  },

  // Loading and error

  loadingContainer: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },

  loadingGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(61, 196, 107, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingOrb: {
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BCEBCB",
  },

  loadingTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 20,
  },

  loadingSubtitle: {
    color: C.muted,
    fontSize: 13,
    marginTop: 7,
  },

  errorContainer: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  errorIcon: {
    width: 66,
    height: 66,
    borderRadius: 23,
    backgroundColor: C.greenLight,
    borderWidth: 1,
    borderColor: C.borderGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  errorTitle: {
    fontSize: 21,
    color: C.text,
    fontWeight: "900",
    textAlign: "center",
  },

  errorMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: C.muted,
    textAlign: "center",
    marginTop: 10,
  },

  retryButton: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    backgroundColor: C.green,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 15,
  },

  retryText: {
    color: C.white,
    fontWeight: "900",
    fontSize: 14,
  },

  // Header

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },

  brandIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },

  brandText: {
    color: C.greenDark,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
  },

  brandSeparator: {
    width: 1,
    height: 12,
    backgroundColor: C.borderGreen,
    marginHorizontal: 10,
  },

  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
    marginRight: 6,
  },

  liveText: {
    fontSize: 9,
    color: C.muted,
    fontWeight: "800",
    letterSpacing: 1,
  },

  greeting: {
    color: C.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },

  userName: {
    color: C.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 2,
  },

  nameAccent: {
    color: C.green,
  },

  headerSubtitle: {
    color: C.muted,
    fontSize: 12,
    marginTop: 7,
    lineHeight: 18,
  },

  avatarTouchable: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarAura: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: "#E0F7E7",
    borderWidth: 1,
    borderColor: "#B9EBC9",
  },

  avatar: {
    width: 53,
    height: 53,
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: C.green,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    color: C.white,
    fontSize: 21,
    fontWeight: "900",
  },

  avatarOnline: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.green,
    borderWidth: 3,
    borderColor: C.white,
  },

  // Insight

  insightOuter: {
    marginBottom: 29,
  },

  insightAura: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: -6,
    height: 35,
    borderRadius: 30,
    backgroundColor: "rgba(54, 198, 102, 0.15)",
  },

  insightCard: {
    borderRadius: 27,
    padding: 19,
    borderWidth: 1,
    borderColor: "#CDEED7",
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#4BAE6C",
    shadowOpacity: 0.13,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
  },

  insightGlowCircle: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -90,
    top: -100,
    backgroundColor: "rgba(91, 214, 125, 0.12)",
  },

  insightTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 19,
  },

  insightLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  insightLabelText: {
    color: C.greenDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },

  aiBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#E5F8EA",
    borderWidth: 1,
    borderColor: "#CDEED7",
  },

  aiBadgeText: {
    color: C.greenDark,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  insightMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },

  insightIcon: {
    width: 51,
    height: 51,
    borderRadius: 18,
    backgroundColor: "#E0F6E7",
    borderWidth: 1,
    borderColor: "#C4EBCF",
    alignItems: "center",
    justifyContent: "center",
  },

  insightCopy: {
    flex: 1,
  },

  insightTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.35,
  },

  insightMessage: {
    color: C.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },

  insightBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 19,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "#D7EFDE",
  },

  insightBottomLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 7,
  },

  insightPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },

  insightBottomText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "600",
  },

  insightArrow: {
    width: 33,
    height: 33,
    borderRadius: 12,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },

  // Section headings

  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
    marginTop: 1,
  },

  sectionTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.45,
  },

  sectionSubtitle: {
    color: C.muted,
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },

  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 7,
  },

  sectionActionText: {
    color: C.greenDark,
    fontSize: 11,
    fontWeight: "800",
  },

  todayTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#E8F8ED",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.borderGreen,
  },

  todayTagText: {
    color: C.greenDark,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  // Liquid glass cards

  glassCard: {
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    elevation: 3,
    shadowColor: C.shadow,
    shadowOpacity: 0.065,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 5 },
  },

  // Mood

  moodCard: {
    padding: 17,
    marginBottom: 28,
    backgroundColor: "rgba(255,255,255,0.96)",
  },

  moodHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 19,
  },

  moodHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EAF8EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  moodTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
  },

  moodSubtitle: {
    color: C.muted,
    fontSize: 10,
    marginTop: 4,
  },

  selectedMoodBadge: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: "#EFF9F1",
    alignItems: "center",
    justifyContent: "center",
  },

  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 5,
  },

  moodOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "transparent",
  },

  moodOptionSelected: {
    backgroundColor: "#F0FAF3",
    borderColor: "#CBEBD5",
  },

  moodEmojiCircle: {
    width: 43,
    height: 43,
    borderRadius: 16,
    backgroundColor: "#F6F9F7",
    borderWidth: 1,
    borderColor: "#EAF0EB",
    alignItems: "center",
    justifyContent: "center",
  },

  moodEmoji: {
    fontSize: 23,
  },

  moodOptionLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 7,
  },

  moodSelectedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
  },

  moodFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },

  smallNeonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },

  moodFooterText: {
    flex: 1,
    color: C.muted,
    fontSize: 10,
    lineHeight: 15,
  },

  // Metrics

  metricsRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 26,
  },

  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 15,
    paddingHorizontal: 5,
    alignItems: "center",
    elevation: 2,
    shadowColor: C.shadow,
    shadowOpacity: 0.045,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  metricIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  metricValue: {
    color: C.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  metricLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 5,
    textAlign: "center",
  },

  // Progress

  progressCard: {
    padding: 18,
    marginBottom: 28,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "#DCEFE2",
  },

  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  progressHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  progressIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#EAF8EE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  cardTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: C.muted,
    fontSize: 10,
    marginTop: 4,
  },

  progressArrow: {
    width: 33,
    height: 33,
    borderRadius: 12,
    backgroundColor: "#EAF8EE",
    alignItems: "center",
    justifyContent: "center",
  },

  progressNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 15,
  },

  progressNumber: {
    color: C.greenDark,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },

  progressUnit: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "700",
  },

  progressCaption: {
    color: C.muted,
    fontSize: 10,
    marginTop: 2,
  },

  progressCountBadge: {
    backgroundColor: "#EFF9F2",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D7EFDE",
  },

  progressCountValue: {
    color: C.greenDark,
    fontSize: 16,
    fontWeight: "900",
  },

  progressCountLabel: {
    color: C.muted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 3,
  },

  progressTrack: {
    height: 9,
    backgroundColor: "#EAF1EC",
    borderRadius: 9,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 9,
  },

  progressFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
  },

  progressLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },

  progressLegendText: {
    color: C.muted,
    fontSize: 10,
    flexShrink: 1,
  },

  progressPercentage: {
    color: C.greenDark,
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 8,
  },

  // Quick start

  quickStartHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  quickHeadingIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#EAF8EE",
    alignItems: "center",
    justifyContent: "center",
  },

  quickStartRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 29,
  },

  quickStartMain: {
    flex: 1,
    borderRadius: 21,
    overflow: "hidden",
    elevation: 4,
    shadowColor: C.green,
    shadowOpacity: 0.17,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },

  quickStartGradient: {
    minHeight: 133,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },

  quickStartGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    right: -45,
    top: -70,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  quickStartIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.52)",
    alignItems: "center",
    justifyContent: "center",
  },

  quickStartEyebrow: {
    color: "#176A39",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },

  quickStartTitle: {
    color: "#104A2B",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },

  quickStartSubtitle: {
    color: "#267448",
    fontSize: 9,
    marginTop: 4,
  },

  quickStartArrow: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: C.greenDark,
    alignItems: "center",
    justifyContent: "center",
  },

  breathingShortcut: {
    width: 103,
    minHeight: 133,
    backgroundColor: C.white,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: C.borderGreen,
    padding: 12,
    justifyContent: "center",
    elevation: 2,
    shadowColor: C.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  breathingIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#EAF8EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },

  breathingTitle: {
    color: C.text,
    fontSize: 12,
    fontWeight: "900",
  },

  breathingCaption: {
    color: C.muted,
    fontSize: 9,
    marginTop: 4,
  },

  // Exercise carousel

  exerciseCarousel: {
    gap: 12,
    paddingBottom: 27,
    paddingRight: 5,
  },

  exerciseCard: {
    width: 190,
    backgroundColor: C.white,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    elevation: 2,
    shadowColor: C.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },

  exerciseCardTop: {
    height: 105,
    padding: 14,
    justifyContent: "space-between",
    overflow: "hidden",
  },

  exerciseCardGlow: {
    position: "absolute",
    right: -30,
    top: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  exerciseEmoji: {
    fontSize: 30,
  },

  exerciseDuration: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.85)",
  },

  exerciseDurationText: {
    color: C.greenDark,
    fontSize: 9,
    fontWeight: "800",
  },

  exerciseCardBody: {
    padding: 13,
  },

  exerciseTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: "900",
  },

  exerciseMeta: {
    color: C.muted,
    fontSize: 9,
    marginTop: 5,
  },

  exerciseOpenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 13,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },

  exerciseOpenText: {
    color: C.greenDark,
    fontSize: 10,
    fontWeight: "900",
  },

  // Recent sessions

  sessionsCard: {
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 27,
  },

  sessionRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },

  noBorder: {
    borderBottomWidth: 0,
  },

  sessionIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#EAF8EE",
    alignItems: "center",
    justifyContent: "center",
  },

  sessionEmoji: {
    fontSize: 21,
  },

  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },

  sessionTitle: {
    color: C.text,
    fontSize: 12,
    fontWeight: "800",
  },

  sessionMeta: {
    color: C.muted,
    fontSize: 9,
    marginTop: 5,
  },

  sessionStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  sessionDone: {
    backgroundColor: "#EAF8EE",
  },

  sessionPending: {
    backgroundColor: "#FFF5E7",
  },

  sessionStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  sessionStatusText: {
    fontSize: 9,
    fontWeight: "900",
  },

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 27,
  },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#EAF8EE",
    borderWidth: 1,
    borderColor: C.borderGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 14,
    color: C.text,
    fontWeight: "900",
  },

  emptyText: {
    fontSize: 11,
    color: C.muted,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 7,
  },

  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 17,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: "#EAF8EE",
  },

  emptyActionText: {
    color: C.greenDark,
    fontSize: 10,
    fontWeight: "900",
  },

  // Account

  accountCard: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },

  accountIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: "#EAF8EE",
    alignItems: "center",
    justifyContent: "center",
  },

  accountIconPurple: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: "#F1EDFC",
    alignItems: "center",
    justifyContent: "center",
  },

  accountCopy: {
    flex: 1,
    minWidth: 0,
  },

  accountLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  accountValue: {
    color: C.text,
    fontSize: 12,
    fontWeight: "700",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },

  manageProfile: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  manageProfileText: {
    flex: 1,
    color: C.greenDark,
    fontSize: 11,
    fontWeight: "900",
  },

  // Logout

  logoutButton: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 16,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F5DEDE",
    marginTop: 2,
  },

  logoutText: {
    color: C.red,
    fontSize: 12,
    fontWeight: "800",
  },

  // Footer branding

  footer: {
    alignItems: "center",
    paddingTop: 29,
    paddingBottom: 7,
  },

  footerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  footerLogo: {
    width: 27,
    height: 27,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.borderGreen,
  },

  footerBrandText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.5,
  },

  footerTagline: {
    color: C.muted,
    fontSize: 10,
    marginTop: 9,
  },

  footerDivider: {
    width: 45,
    height: 2,
    borderRadius: 2,
    backgroundColor: C.green,
    marginTop: 17,
    marginBottom: 15,
  },

  developedBy: {
    color: C.mutedLight,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.8,
  },

  developerName: {
    color: C.greenDark,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 5,
    letterSpacing: 0.3,
  },

  footerCopyrightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
  },

  footerCopyright: {
    color: C.mutedLight,
    fontSize: 9,
  },
});
