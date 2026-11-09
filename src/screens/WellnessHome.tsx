// src/screens/WellnessHome.tsx


import React, { useCallback, useEffect, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Heart,
  Leaf,
  LogOut,
  Mail,
  RefreshCw,
  Smile,
  Sparkles,
  Target,
  UserRound,
  Wind,
} from "lucide-react-native";

import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../services/profileService";
import { moodService } from "../services/moodService";
import {
  fetchWellnessMetrics,
  fetchFeaturedExercises,
  WellnessMetrics,
} from "../services/wellnessMetricsService";

type Props = {
  user: any;
  onOpenBreathing?: () => void;
  onOpenExercise?: (exercise: any) => void;
  onOpenProgress?: () => void;
  onOpenMood?: () => void;
  onOpenProfile?: () => void;
  bottomOffset?: number;
};

const C = {
  background: "#F4F8F5",
  surface: "#FFFFFF",
  primary: "#247A4A",
  primaryDark: "#155C36",
  primaryLight: "#E4F3E9",
  text: "#1D3025",
  muted: "#7B8A80",
  border: "#E8EFEA",
  blue: "#4269C9",
  blueLight: "#EDF1FF",
  orange: "#B76C19",
  orangeLight: "#FFF1DF",
  purple: "#7955B5",
  purpleLight: "#F1EAFC",
};

const MOODS = [
  { emoji: "😢", label: "Low", color: "#DDE7FF" },
  { emoji: "😕", label: "Meh", color: "#E5E7FF" },
  { emoji: "😐", label: "Okay", color: "#FFF0CF" },
  { emoji: "🙂", label: "Good", color: "#D8F2DE" },
  { emoji: "😄", label: "Great", color: "#BDECCB" },
];

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
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
      <View style={styles.sectionHeadingText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>

      {!!action && !!onAction && (
        <TouchableOpacity
          onPress={onAction}
          style={styles.sectionAction}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.sectionActionText}>{action}</Text>
          <ChevronRight size={15} color={C.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  tint,
  iconColor,
}: {
  icon: React.ComponentType<any>;
  value: string | number;
  label: string;
  tint: string;
  iconColor: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: tint }]}>
        <Icon size={19} color={iconColor} strokeWidth={2.2} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionTile({
  icon: Icon,
  label,
  caption,
  tint,
  iconColor,
  onPress,
}: {
  icon: React.ComponentType<any>;
  label: string;
  caption: string;
  tint: string;
  iconColor: string;
  onPress?: () => void;
}) {
  if (!onPress) return null;

  return (
    <TouchableOpacity
      style={styles.actionTile}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { backgroundColor: tint }]}>
        <Icon size={21} color={iconColor} strokeWidth={2.1} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{label}</Text>
        <Text style={styles.actionCaption}>{caption}</Text>
      </View>
      <ChevronRight size={17} color="#A4B2A8" />
    </TouchableOpacity>
  );
}

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

  const [profile, setProfile] = useState<any>(null);
  const [metrics, setMetrics] = useState<WellnessMetrics | null>(null);
  const [featured, setFeatured] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingMood, setLoggingMood] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const userId = user?.id;

    if (!userId) {
      setLoadError("Your account could not be identified. Please sign in again.");
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
      setProfile(profileResult.value);
    } else {
      console.warn("Profile loading failed:", profileResult.reason);
    }

    if (featuredResult.status === "fulfilled") {
      setFeatured(featuredResult.value ?? []);
    } else {
      console.warn("Featured exercises failed:", featuredResult.reason);
    }

    if (metricsResult.status === "fulfilled") {
      setMetrics(metricsResult.value);
    } else {
      console.error("Wellness metrics loading failed:", metricsResult.reason);
      setLoadError(
        "We couldn't load your wellness statistics. Check your connection and try again."
      );
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    const initialLoad = async () => {
      setLoading(true);
      await loadAll();
      if (active) setLoading(false);
    };

    initialLoad();

    return () => {
      active = false;
    };
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  const handleQuickMood = async (moodValue: number) => {
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
      Alert.alert("Mood saved", "Thanks for checking in with yourself.");
    } catch (error: any) {
      Alert.alert(
        "Couldn't save mood",
        error?.message ?? "Please try again."
      );
    } finally {
      setLoggingMood(false);
    }
  };

  const logout = () => {
    Alert.alert("Log out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
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
    ]);
  };

  if (loading && !metrics) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={C.background} />
        <LinearGradient
          colors={["#DDF2E5", "#F4F8F5"]}
          style={styles.loadingOrb}
        >
          <Leaf size={32} color={C.primary} />
        </LinearGradient>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={styles.loadingTitle}>Preparing your wellness space</Text>
        <Text style={styles.loadingSubtitle}>A little care goes a long way.</Text>
      </View>
    );
  }

  if (!metrics) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <RefreshCw size={27} color={C.primary} />
        </View>
        <Text style={styles.errorTitle}>Let's try that again</Text>
        <Text style={styles.errorMessage}>
          {loadError ?? "Your wellness information is temporarily unavailable."}
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
          <RefreshCw size={17} color="#FFFFFF" />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { todayMood, todayActivities, weeklyStats, recentSessions } = metrics;

  const firstName =
    profile?.full_name?.trim()?.split(/\s+/)[0] ?? "there";

  const avatarInitial = (
    profile?.full_name ?? user?.email ?? "U"
  )
    .toString()
    .charAt(0)
    .toUpperCase();

  const progress = todayActivities.total > 0
    ? Math.min(todayActivities.completed / todayActivities.total, 1)
    : 0;

  const mood = todayMood?.mood ?? null;
  const selectedMood = mood && mood >= 1 && mood <= 5
    ? MOODS[mood - 1]
    : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: bottomOffset + insets.bottom + 20,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* Welcome header */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.eyebrow}>
              <Sparkles size={13} color={C.primary} />
              <Text style={styles.eyebrowText}>YOUR WELLNESS SPACE</Text>
            </View>

            <Text style={styles.hello}>Hello, {firstName}</Text>
            <Text style={styles.subtitle}>
              {todayMood
                ? "You made time for yourself today."
                : "How are you feeling today?"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.avatarOuter}
            onPress={onOpenProfile}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <LinearGradient
              colors={["#3C9963", "#17623A"]}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{avatarInitial}</Text>
            </LinearGradient>
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>

        {/* Mood check-in */}
        <LinearGradient
          colors={["#E4F5E9", "#D3EEDF", "#E9F6EE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />

          <View style={styles.heroHeadingRow}>
            <View style={styles.heroIcon}>
              <Heart size={20} color={C.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.heroHeadingCopy}>
              <Text style={styles.heroTitle}>Mood check-in</Text>
              <Text style={styles.heroSubtitle}>
                A moment to see how you're doing.
              </Text>
            </View>
            {selectedMood && (
              <View style={styles.selectedMoodChip}>
                <Text style={styles.selectedMoodEmoji}>{selectedMood.emoji}</Text>
              </View>
            )}
          </View>

          <View style={styles.moodRow}>
            {MOODS.map((item, index) => {
              const value = index + 1;
              const selected = mood === value;

              return (
                <TouchableOpacity
                  key={item.label}
                  disabled={loggingMood}
                  onPress={() => handleQuickMood(value)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Log mood: ${item.label}`}
                  accessibilityState={{ selected, disabled: loggingMood }}
                  style={[
                    styles.moodButton,
                    selected && styles.moodButtonSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.moodBubble,
                      { backgroundColor: item.color },
                      selected && styles.moodBubbleSelected,
                    ]}
                  >
                    <Text style={styles.moodEmoji}>{item.emoji}</Text>
                  </View>
                  <Text
                    style={[
                      styles.moodLabel,
                      selected && styles.moodLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.heroFooterDot} />
            <Text style={styles.heroFooterText}>
              {loggingMood
                ? "Saving your check-in..."
                : todayMood
                  ? `Checked in today · Energy ${todayMood.energy ?? "—"} · Stress ${todayMood.stress ?? "—"}`
                  : "Choose a mood to record your check-in"}
            </Text>
          </View>
        </LinearGradient>

        {/* Weekly metrics */}
        <SectionHeading
          title="Your wellness at a glance"
          subtitle="Small steps add up."
        />

        <View style={styles.metricsRow}>
          <MetricCard
            icon={Flame}
            value={weeklyStats.streakDays}
            label="Day streak"
            tint={C.primaryLight}
            iconColor={C.primary}
          />
          <MetricCard
            icon={Clock3}
            value={weeklyStats.totalMinutes}
            label="Minutes this week"
            tint={C.blueLight}
            iconColor={C.blue}
          />
          <MetricCard
            icon={Smile}
            value={weeklyStats.avgMood ?? "—"}
            label="Average mood"
            tint={C.orangeLight}
            iconColor={C.orange}
          />
        </View>

        {/* Today's progress */}
        <View style={styles.progressCard}>
          <LinearGradient
            colors={["#FFFFFF", "#F9FCFA"]}
            style={styles.progressCardInner}
          >
            <View style={styles.progressHeader}>
              <View style={styles.progressTitleWrap}>
                <View style={styles.progressIcon}>
                  <Target size={20} color={C.primary} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Today's progress</Text>
                  <Text style={styles.cardSubtitle}>Keep your momentum going</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onOpenProgress}
                disabled={!onOpenProgress}
                style={styles.roundArrow}
                accessibilityRole="button"
                accessibilityLabel="View progress"
              >
                <ChevronRight size={19} color={C.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.progressNumbers}>
              <Text style={styles.progressMinutes}>
                {todayActivities.totalMinutes}
                <Text style={styles.progressMinutesUnit}> min</Text>
              </Text>
              <Text style={styles.progressCount}>
                {todayActivities.completed} of {todayActivities.total} activities
              </Text>
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
                colors={["#51B879", "#247A4A"]}
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
                <CheckCircle2 size={14} color={C.primary} />
                <Text style={styles.progressLegendText}>
                  {todayActivities.completed > 0
                    ? "Nice work — keep it up!"
                    : "Your next small step starts here."}
                </Text>
              </View>
              <Text style={styles.progressPercent}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Quick actions */}
        <SectionHeading
          title="Quick actions"
          subtitle="Choose what you need right now."
        />

        <View style={styles.actionsCard}>
          <ActionTile
            icon={Wind}
            label="Breathing"
            caption="Find your calm"
            tint={C.primaryLight}
            iconColor={C.primary}
            onPress={onOpenBreathing}
          />
          <View style={styles.rowDivider} />
          <ActionTile
            icon={BarChart3}
            label="Your progress"
            caption="See your journey"
            tint={C.blueLight}
            iconColor={C.blue}
            onPress={onOpenProgress}
          />
          <View style={styles.rowDivider} />
          <ActionTile
            icon={Heart}
            label="Log your mood"
            caption="Check in with yourself"
            tint={C.purpleLight}
            iconColor={C.purple}
            onPress={onOpenMood}
          />
          <View style={styles.rowDivider} />
          <ActionTile
            icon={BookOpen}
            label="Explore exercise"
            caption="Move at your own pace"
            tint={C.orangeLight}
            iconColor={C.orange}
            onPress={() => {
              if (featured[0]) onOpenExercise?.(featured[0]);
              else onOpenMood?.();
            }}
          />
        </View>

        {/* Recent sessions */}
        <SectionHeading
          title="Recent sessions"
          subtitle="Your latest wellness activities."
          action={onOpenProgress ? "See all" : undefined}
          onAction={onOpenProgress}
        />

        <View style={styles.sessionsCard}>
          {recentSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={["#E8F6EC", "#D9F0E1"]}
                style={styles.emptyIcon}
              >
                <Sparkles size={24} color={C.primary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>Your journey starts here</Text>
              <Text style={styles.emptyText}>
                Complete a wellness session and it will appear here.
              </Text>
            </View>
          ) : (
            recentSessions.map((session, index) => (
              <View
                key={session.id}
                style={[
                  styles.sessionRow,
                  index === recentSessions.length - 1 && styles.noBorder,
                ]}
              >
                <View style={styles.sessionIconWrap}>
                  <Text style={styles.sessionEmoji}>
                    {session.icon ?? "🧘"}
                  </Text>
                </View>

                <View style={styles.sessionCopy}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>
                    {session.title}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {new Date(session.started_at).toLocaleDateString()}{" "}
                    · {Math.round((session.duration_seconds ?? 0) / 60)} min
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    session.completed
                      ? styles.statusDone
                      : styles.statusPending,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: session.completed
                          ? C.primary
                          : "#D38B25",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: session.completed ? C.primary : "#A36A16",
                      },
                    ]}
                  >
                    {session.completed ? "Done" : "In progress"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recommended exercises */}
        {featured.length > 0 && (
          <>
            <SectionHeading
              title="Picked for you"
              subtitle="Make a little space for yourself."
            />

            <View style={styles.recommendationsCard}>
              {featured.map((exercise, index) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={[
                    styles.exerciseRow,
                    index === featured.length - 1 && styles.noBorder,
                  ]}
                  onPress={() => onOpenExercise?.(exercise)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${exercise.title}`}
                >
                  <LinearGradient
                    colors={
                      index % 2 === 0
                        ? ["#DDF2E5", "#CDEAD8"]
                        : ["#E7EDFF", "#D8E2FF"]
                    }
                    style={styles.exerciseIcon}
                  >
                    <Text style={styles.exerciseEmoji}>
                      {exercise.icon ?? "🧘"}
                    </Text>
                  </LinearGradient>

                  <View style={styles.exerciseCopy}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {exercise.title}
                    </Text>
                    <Text style={styles.sessionMeta} numberOfLines={1}>
                      {exercise.category ?? "Wellness"}
                      {exercise.duration_minutes
                        ? ` · ${exercise.duration_minutes} min`
                        : ""}
                      {exercise.difficulty
                        ? ` · ${exercise.difficulty}`
                        : ""}
                    </Text>
                  </View>

                  <View style={styles.exerciseArrow}>
                    <ChevronRight size={18} color={C.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Account details */}
        <SectionHeading title="Your account" />

        <View style={styles.accountCard}>
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Mail size={17} color={C.primary} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountLabel}>Email address</Text>
              <Text style={styles.accountValue} numberOfLines={1}>
                {profile?.email ?? user?.email ?? "Not available"}
              </Text>
            </View>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.accountRow}>
            <View style={[styles.accountIcon, styles.accountIconPurple]}>
              <Target size={17} color={C.purple} />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountLabel}>Wellness goal</Text>
              <Text style={styles.accountValue} numberOfLines={2}>
                {profile?.wellness_goal ?? "No wellness goal set yet"}
              </Text>
            </View>
          </View>

          {!!onOpenProfile && (
            <>
              <View style={styles.rowDivider} />
              <TouchableOpacity
                style={styles.profileLink}
                onPress={onOpenProfile}
                activeOpacity={0.75}
              >
                <UserRound size={17} color={C.primary} />
                <Text style={styles.profileLinkText}>Manage profile</Text>
                <ChevronRight size={17} color={C.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <LogOut size={17} color="#B54C4C" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <View style={styles.footerMark}>
            <Leaf size={13} color={C.primary} />
          </View>
          <Text style={styles.footerText}>
            Take it one day at a time.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

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

  // Loading and error states
  loadingContainer: {
    flex: 1,
    backgroundColor: C.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  loadingOrb: {
    width: 86,
    height: 86,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  loadingTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 18,
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
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  errorTitle: {
    fontSize: 21,
    color: C.text,
    fontWeight: "800",
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
    backgroundColor: C.primary,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 15,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 7,
  },
  eyebrowText: {
    color: C.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.25,
  },
  hello: {
    fontSize: 27,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 5,
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  avatarOuter: {
    width: 55,
    height: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 49,
    height: 49,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 4,
    shadowColor: C.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarText: {
    fontSize: 19,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#5AC982",
    borderWidth: 2,
    borderColor: C.background,
  },

  // Mood hero
  hero: {
    borderRadius: 27,
    padding: 19,
    marginBottom: 27,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#4D9567",
    shadowOpacity: 0.11,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 7 },
  },
  heroGlow: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -70,
    top: -70,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  heroHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 21,
  },
  heroIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  heroHeadingCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#63776A",
  },
  selectedMoodChip: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  selectedMoodEmoji: {
    fontSize: 24,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  moodButton: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "transparent",
  },
  moodButtonSelected: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderColor: C.primary,
  },
  moodBubble: {
    width: 43,
    height: 43,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  moodBubbleSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 3,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabel: {
    fontSize: 10,
    color: "#64766A",
    fontWeight: "700",
  },
  moodLabelSelected: {
    color: C.primaryDark,
    fontWeight: "900",
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(36,122,74,0.12)",
  },
  heroFooterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
    marginRight: 7,
  },
  heroFooterText: {
    flex: 1,
    fontSize: 11,
    color: "#526B5A",
    lineHeight: 16,
  },

  // Section headings
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
    marginTop: 1,
  },
  sectionHeadingText: {
    flex: 1,
    paddingRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.35,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: C.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 6,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: C.primary,
  },

  // Metric cards
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 25,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: C.surface,
    borderRadius: 21,
    paddingHorizontal: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDF2EE",
    elevation: 2,
    shadowColor: "#284A34",
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  metricValue: {
    color: C.text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  metricLabel: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "600",
  },

  // Today's progress
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "#E6EEE8",
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#244B31",
    shadowOpacity: 0.055,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  progressCardInner: {
    padding: 18,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  progressIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  cardTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900",
  },
  cardSubtitle: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
  },
  roundArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  progressNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 21,
    marginBottom: 12,
  },
  progressMinutes: {
    color: C.primaryDark,
    fontSize: 31,
    fontWeight: "900",
    letterSpacing: -1,
  },
  progressMinutesUnit: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
    color: C.muted,
  },
  progressCount: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#E9F0EB",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 10,
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
    flex: 1,
    gap: 6,
  },
  progressLegendText: {
    fontSize: 11,
    color: C.muted,
    flexShrink: 1,
  },
  progressPercent: {
    color: C.primary,
    fontSize: 12,
    fontWeight: "900",
    marginLeft: 8,
  },

  // Action list
  actionsCard: {
    backgroundColor: C.surface,
    borderRadius: 23,
    paddingHorizontal: 15,
    paddingVertical: 4,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "#E9F0EB",
    elevation: 2,
    shadowColor: "#244B31",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  actionTile: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  actionCopy: {
    flex: 1,
    paddingRight: 8,
  },
  actionTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  actionCaption: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },

  // Sessions and recommendations
  sessionsCard: {
    backgroundColor: C.surface,
    borderRadius: 23,
    paddingHorizontal: 15,
    paddingVertical: 2,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "#E9F0EB",
  },
  sessionRow: {
    minHeight: 76,
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
  sessionIconWrap: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#EFF7F1",
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
    fontSize: 13,
    fontWeight: "800",
  },
  sessionMeta: {
    color: C.muted,
    fontSize: 10,
    marginTop: 5,
    lineHeight: 15,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusDone: {
    backgroundColor: "#E7F5EB",
  },
  statusPending: {
    backgroundColor: "#FFF3DE",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 27,
  },
  emptyIcon: {
    width: 57,
    height: 57,
    borderRadius: 20,
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
    fontSize: 12,
    color: C.muted,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 7,
  },
  recommendationsCard: {
    backgroundColor: C.surface,
    borderRadius: 23,
    paddingHorizontal: 15,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: "#E9F0EB",
  },
  exerciseRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  exerciseIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseEmoji: {
    fontSize: 22,
  },
  exerciseCopy: {
    flex: 1,
    minWidth: 0,
  },
  exerciseArrow: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  // Account
  accountCard: {
    backgroundColor: C.surface,
    borderRadius: 23,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#E9F0EB",
    marginBottom: 15,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  accountIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  accountIconPurple: {
    backgroundColor: C.purpleLight,
  },
  accountCopy: {
    flex: 1,
  },
  accountLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  accountValue: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
  },
  profileLink: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  profileLinkText: {
    flex: 1,
    color: C.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  logoutButton: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 17,
    backgroundColor: "#FFF0EF",
    borderWidth: 1,
    borderColor: "#F6DAD8",
    marginTop: 2,
  },
  logoutText: {
    color: "#B54C4C",
    fontSize: 13,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingTop: 22,
    paddingBottom: 4,
  },
  footerMark: {
    width: 23,
    height: 23,
    borderRadius: 9,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "600",
  },
});
