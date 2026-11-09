// src/screens/ProgressScreen.tsx

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
  ScrollView,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";

import LinearGradient from "react-native-linear-gradient";

import {
  Activity,
  Award,
  Brain,
  Check,
  Clock3,
  Flame,
  Heart,
  Leaf,
  Sparkles,
  TrendingUp,
  Wind,
} from "lucide-react-native";

import {
  useScreenLayout,
} from "../context/ScreenLayoutContext";

import {
  fetchWellnessMetrics,
  type WellnessMetrics,
} from "../services/wellnessMetricsService";

// ============================================================================
// TYPES
// ============================================================================

type Props = {
  user: any;
};

type StatCardProps = {
  icon: React.ReactNode;
  value: string;
  label: string;
  caption: string;
  accent: string;
  background: string;
  width: number;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  background: "#F3F8F4",
  surface: "#FFFFFF",
  primary: "#247A4A",
  primaryLight: "#E3F4E9",
  mint: "#BFEBD0",
  text: "#20382A",
  secondary: "#74847A",
  border: "#E5EEE7",
  muted: "#A3B0A7",
  orange: "#F2A65A",
  purple: "#8E80D8",
  blue: "#6D9FEA",
};

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  icon,
  value,
  label,
  caption,
  accent,
  background,
  width,
}: StatCardProps) {
  return (
    <View style={[styles.statCard, { width }]}>
      <View
        style={[
          styles.statIconContainer,
          { backgroundColor: background },
        ]}
      >
        {icon}
      </View>

      <Text style={styles.statValue}>{value}</Text>

      <Text style={styles.statLabel}>{label}</Text>

      <Text style={styles.statCaption}>{caption}</Text>

      <View
        style={[
          styles.statAccent,
          { backgroundColor: accent },
        ]}
      />
    </View>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatSessionDuration(seconds: number): string {
  const safeSeconds = Math.max(
    0,
    Math.floor(seconds || 0),
  );

  if (safeSeconds < 60) {
    return `${safeSeconds} sec`;
  }

  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${remainingSeconds} sec`;
}

function formatSessionDate(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const today = new Date();
  const yesterday = new Date();

  yesterday.setDate(yesterday.getDate() - 1);

  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

  if (dateKey(date) === dateKey(today)) {
    return "Today";
  }

  if (dateKey(date) === dateKey(yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function ProgressScreen({ user }: Props) {
  const layout = useScreenLayout();

  const { width: screenWidth } = useWindowDimensions();

  const userId = user?.id ?? user?.user?.id ?? null;

  // --------------------------------------------------------------------------
  // RESPONSIVE LAYOUT
  // --------------------------------------------------------------------------

  const horizontalPadding = layout.horizontalPadding;

  const contentWidth = Math.max(
    0,
    screenWidth - horizontalPadding * 2,
  );

  const cardGap = 12;

  const statCardWidth = Math.max(
    0,
    (contentWidth - cardGap) / 2,
  );

  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------

  const [metrics, setMetrics] =
    useState<WellnessMetrics | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // LOAD REAL METRICS
  // --------------------------------------------------------------------------

  const loadProgress = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setError(
          "Your account could not be identified. Please sign in again.",
        );

        setLoading(false);
        setRefreshing(false);

        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const result = await fetchWellnessMetrics(userId);

        setMetrics(result);
      } catch (err: any) {
        console.error(
          "[ProgressScreen] Failed to load metrics:",
          err,
        );

        setError(
          "We couldn't load your progress. Please check your connection or try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const onRefresh = useCallback(() => {
    void loadProgress(true);
  }, [loadProgress]);

  // --------------------------------------------------------------------------
  // DERIVED STATISTICS
  // --------------------------------------------------------------------------

  const stats = metrics?.weeklyStats;

  const dailyActivity = metrics?.dailyActivity ?? [];

  const activeDays = useMemo(
    () =>
      dailyActivity.filter(
        (day) => day.sessionsCount > 0,
      ).length,
    [dailyActivity],
  );

  const maxMinutes = useMemo(
    () =>
      Math.max(
        1,
        ...dailyActivity.map(
          (day) => day.totalMinutes,
        ),
      ),
    [dailyActivity],
  );

  // --------------------------------------------------------------------------
  // STATUS BAR
  // --------------------------------------------------------------------------

  const statusBar = (
    <StatusBar
      barStyle="dark-content"
      backgroundColor={COLORS.background}
      translucent={false}
    />
  );

  // --------------------------------------------------------------------------
  // LOADING SCREEN
  // --------------------------------------------------------------------------

  if (loading && !metrics) {
    return (
      <View style={styles.stateContainer}>
        {statusBar}

        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.stateTitle}>
          Loading your progress
        </Text>

        <Text style={styles.stateDescription}>
          Gathering your latest wellness activity...
        </Text>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // ERROR SCREEN
  // --------------------------------------------------------------------------

  if (error && !metrics) {
    return (
      <View style={styles.stateContainer}>
        {statusBar}

        <View style={styles.errorIcon}>
          <Activity
            size={30}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.stateTitle}>
          Unable to load progress
        </Text>

        <Text style={styles.stateDescription}>
          {error}
        </Text>

        <Pressable
          onPress={() => void loadProgress()}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN UI
  // --------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {statusBar}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: layout.topPadding,
            paddingHorizontal: horizontalPadding,
            paddingBottom: layout.bottomPadding,
          },
        ]}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerText}>
            <View style={styles.eyebrow}>
              <Sparkles
                size={14}
                color={COLORS.primary}
              />

              <Text style={styles.eyebrowText}>
                YOUR WELLNESS JOURNEY
              </Text>
            </View>

            <Text style={styles.title}>
              Your progress
            </Text>

            <Text style={styles.subtitle}>
              Every small step is a step forward.
            </Text>
          </View>

          <LinearGradient
            colors={[
              "#D9F4E3",
              "#B7E7C9",
              "#EAF8EF",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBadge}
          >
            <Activity
              size={25}
              color={COLORS.primary}
            />
          </LinearGradient>
        </View>

        {/* STREAK HERO */}

        <LinearGradient
          colors={[
            "#226D43",
            "#2D8956",
            "#51A977",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakCard}
        >
          <View style={styles.streakGlowOne} />

          <View style={styles.streakGlowTwo} />

          <View style={styles.streakTopRow}>
            <View style={styles.streakPill}>
              <Flame
                size={14}
                color="#FFE0A4"
              />

              <Text style={styles.streakPillText}>
                CURRENT STREAK
              </Text>
            </View>

            <View style={styles.streakAward}>
              <Award
                size={22}
                color="#FFE3A7"
              />
            </View>
          </View>

          <View style={styles.streakMain}>
            <View style={styles.streakNumberWrap}>
              <Text style={styles.streakNumber}>
                {stats?.streakDays ?? 0}
              </Text>

              <Text style={styles.streakDays}>
                {(stats?.streakDays ?? 0) === 1
                  ? "day"
                  : "days"}
              </Text>
            </View>

            <View style={styles.streakMessage}>
              <Text style={styles.streakHeadline}>
                {(stats?.streakDays ?? 0) > 0
                  ? "You're building a habit!"
                  : "Your journey starts today"}
              </Text>

              <Text style={styles.streakDescription}>
                {(stats?.streakDays ?? 0) > 0
                  ? "Keep showing up for yourself. Consistency matters more than perfection."
                  : "Complete a wellness session today to start building your streak."}
              </Text>
            </View>
          </View>

          <View style={styles.streakFooter}>
            <View style={styles.streakFooterIcon}>
              <Check
                size={14}
                color="#FFFFFF"
              />
            </View>

            <Text style={styles.streakFooterText}>
              One day at a time
            </Text>

            <View style={styles.streakFooterSpacer} />

            <Leaf
              size={17}
              color="#C9F1D7"
            />
          </View>
        </LinearGradient>

        {/* WELLNESS SNAPSHOT */}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>
              Your wellness snapshot
            </Text>

            <Text style={styles.sectionSubtitle}>
              Your actual recorded activity over the last 7 days.
            </Text>
          </View>

          <View style={styles.sectionIcon}>
            <TrendingUp
              size={19}
              color={COLORS.primary}
            />
          </View>
        </View>

        {/* STATISTICS */}

        <View style={styles.statsGrid}>
          <StatCard
            icon={
              <Activity
                size={22}
                color={COLORS.primary}
              />
            }
            value={String(stats?.sessionsCount ?? 0)}
            label="Exercises"
            caption="Completed sessions"
            accent={COLORS.primary}
            background="#E4F5E9"
            width={statCardWidth}
          />

          <StatCard
            icon={
              <Wind
                size={22}
                color={COLORS.blue}
              />
            }
            value={String(stats?.breathingSessions ?? 0)}
            label="Breathing"
            caption="Completed breathing sessions"
            accent={COLORS.blue}
            background="#EAF1FF"
            width={statCardWidth}
          />

          <StatCard
            icon={
              <Clock3
                size={22}
                color={COLORS.orange}
              />
            }
            value={String(stats?.totalMinutes ?? 0)}
            label="Minutes"
            caption="Recorded session duration"
            accent={COLORS.orange}
            background="#FFF1E0"
            width={statCardWidth}
          />

          <StatCard
            icon={
              <Heart
                size={22}
                color={COLORS.purple}
              />
            }
            value={`${stats?.completionRate ?? 0}%`}
            label="Completion rate"
            caption="Completed / started sessions"
            accent={COLORS.purple}
            background="#F0ECFF"
            width={statCardWidth}
          />
        </View>

        {/* WEEKLY ACTIVITY */}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>
              Weekly activity
            </Text>

            <Text style={styles.sectionSubtitle}>
              Your recorded sessions from the last seven days.
            </Text>
          </View>

          <View style={styles.weekBadge}>
            <Text style={styles.weekBadgeText}>
              7 DAYS
            </Text>
          </View>
        </View>

        <View style={styles.weekCard}>
          <View style={styles.weekSummary}>
            <View>
              <Text style={styles.weekSummaryNumber}>
                {activeDays}
              </Text>

              <Text style={styles.weekSummaryLabel}>
                Active days
              </Text>
            </View>

            <View style={styles.weekSummaryDivider} />

            <View style={styles.weekSummaryRight}>
              <View style={styles.weekTrend}>
                <TrendingUp
                  size={14}
                  color={COLORS.primary}
                />

                <Text style={styles.weekTrendText}>
                  {activeDays === 0
                    ? "Ready when you are"
                    : `${activeDays} of 7 days active`}
                </Text>
              </View>

              <Text style={styles.weekSummaryHint}>
                Based on completed sessions
              </Text>
            </View>
          </View>

          <View style={styles.chart}>
            {dailyActivity.map((item) => {
              const active = item.sessionsCount > 0;

              const barHeight = active
                ? Math.max(
                    8,
                    (item.totalMinutes / maxMinutes) * 70,
                  )
                : 5;

              return (
                <View
                  key={item.date}
                  style={styles.chartColumn}
                >
                  <View style={styles.barTrack}>
                    <LinearGradient
                      colors={
                        active
                          ? ["#75D99B", "#247A4A"]
                          : ["#E9F0EB", "#DDE8E0"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[
                        styles.bar,
                        { height: barHeight },
                      ]}
                    />

                    {active && (
                      <View style={styles.barHighlight} />
                    )}
                  </View>

                  <View
                    style={[
                      styles.dayDot,
                      active && styles.dayDotActive,
                    ]}
                  >
                    {active && (
                      <Check
                        size={10}
                        color="#FFFFFF"
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.chartDay,
                      active && styles.chartDayActive,
                    ]}
                  >
                    {item.day.substring(0, 1)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.legendDot} />

            <Text style={styles.legendText}>
              Completed sessions
            </Text>

            <View style={styles.legendSpacer} />

            <Text style={styles.legendText}>
              Bar height = minutes
            </Text>
          </View>

          {activeDays === 0 && (
            <Text style={styles.emptyChartText}>
              No completed sessions recorded this week yet.
            </Text>
          )}
        </View>

        {/* RECENT SESSIONS */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Recent sessions
            </Text>

            <Text style={styles.sectionSubtitle}>
              Your latest recorded wellness activities.
            </Text>
          </View>
        </View>

        <View style={styles.recentCard}>
          {metrics?.recentSessions &&
          metrics.recentSessions.length > 0 ? (
            metrics.recentSessions.map((session, index) => (
              <View key={session.id}>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionIcon}>
                    <Text style={styles.sessionEmoji}>
                      {session.icon || "🧘"}
                    </Text>
                  </View>

                  <View style={styles.sessionDetails}>
                    <Text
                      style={styles.sessionTitle}
                      numberOfLines={1}
                    >
                      {session.title}
                    </Text>

                    <Text style={styles.sessionSubtitle}>
                      {formatSessionDate(session.started_at)}
                      {"  ·  "}
                      {formatSessionDuration(
                        session.duration_seconds,
                      )}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.sessionStatus,
                      session.completed
                        ? styles.sessionStatusComplete
                        : styles.sessionStatusIncomplete,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sessionStatusText,
                        session.completed
                          ? styles.sessionStatusTextComplete
                          : styles.sessionStatusTextIncomplete,
                      ]}
                    >
                      {session.completed
                        ? "Done"
                        : "Incomplete"}
                    </Text>
                  </View>
                </View>

                {index <
                  metrics.recentSessions.length - 1 && (
                  <View style={styles.sessionDivider} />
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptySessions}>
              <Activity
                size={25}
                color={COLORS.muted}
              />

              <Text style={styles.emptySessionsTitle}>
                No sessions yet
              </Text>

              <Text style={styles.emptySessionsText}>
                Your completed wellness sessions will appear here.
              </Text>
            </View>
          )}
        </View>

        {/* WELLNESS INSIGHT */}

        <LinearGradient
          colors={["#F0FAF3", "#E1F4E8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.insightCard}
        >
          <View style={styles.insightIcon}>
            <Brain
              size={24}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.insightContent}>
            <View style={styles.insightHeadingRow}>
              <Text style={styles.insightTitle}>
                A gentle reminder
              </Text>

              <Sparkles
                size={15}
                color="#67A97F"
              />
            </View>

            <Text style={styles.insightText}>
              Wellness isn't a race. Take a moment to breathe,
              stretch, or rest whenever you need it.
            </Text>
          </View>
        </LinearGradient>

        <Text style={styles.footerText}>
          Progress at your own pace · Your wellbeing matters 🌿
        </Text>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
  },

  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    backgroundColor: COLORS.background,
  },

  stateTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 18,
    textAlign: "center",
  },

  stateDescription: {
    color: COLORS.secondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },

  errorIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  retryButton: {
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
  },

  retryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  headerText: {
    flex: 1,
    paddingRight: 12,
  },

  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },

  eyebrowText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.secondary,
  },

  headerBadge: {
    width: 55,
    height: 55,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    elevation: 4,
    shadowColor: "#247A4A",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  streakCard: {
    borderRadius: 28,
    padding: 21,
    marginBottom: 30,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#1D6B40",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },

  streakGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.07)",
    right: -55,
    top: -70,
  },

  streakGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(183,239,202,0.10)",
    right: 25,
    bottom: -75,
  },

  streakTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
  },

  streakPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  streakAward: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  streakMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
  },

  streakNumberWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 85,
  },

  streakNumber: {
    fontSize: 58,
    lineHeight: 64,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -2,
  },

  streakDays: {
    color: "#D7F4E0",
    fontSize: 14,
    fontWeight: "700",
    marginTop: -1,
  },

  streakMessage: {
    flex: 1,
  },

  streakHeadline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 7,
  },

  streakDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#D7F0DF",
  },

  streakFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.19)",
  },

  streakFooterIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  streakFooterText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  streakFooterSpacer: {
    flex: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  sectionHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "850",
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 4,
  },

  sectionIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: "#E3F3E8",
    alignItems: "center",
    justifyContent: "center",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 30,
  },

  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 23,
    padding: 15,
    minHeight: 157,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#254B32",
    shadowOpacity: 0.055,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },

  statIconContainer: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  statValue: {
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.6,
  },

  statLabel: {
    fontSize: 13,
    fontWeight: "750",
    color: COLORS.text,
    marginTop: 3,
  },

  statCaption: {
    fontSize: 10,
    color: COLORS.secondary,
    marginTop: 5,
  },

  statAccent: {
    position: "absolute",
    right: -16,
    bottom: -21,
    width: 65,
    height: 65,
    borderRadius: 33,
    opacity: 0.08,
  },

  weekBadge: {
    backgroundColor: "#E4F3E9",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },

  weekBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "850",
    letterSpacing: 0.8,
  },

  weekCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 25,
    padding: 19,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 3,
    shadowColor: "#254B32",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  weekSummary: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },

  weekSummaryNumber: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "900",
    color: COLORS.text,
  },

  weekSummaryLabel: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 2,
  },

  weekSummaryDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
    marginHorizontal: 20,
  },

  weekSummaryRight: {
    flex: 1,
  },

  weekTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },

  weekTrendText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
  },

  weekSummaryHint: {
    fontSize: 10,
    color: COLORS.secondary,
  },

  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    minHeight: 112,
    paddingHorizontal: 3,
  },

  chartColumn: {
    flex: 1,
    alignItems: "center",
  },

  barTrack: {
    height: 70,
    width: 24,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#F1F6F2",
    borderRadius: 12,
    overflow: "hidden",
  },

  bar: {
    width: 24,
    minHeight: 5,
    borderRadius: 12,
  },

  barHighlight: {
    position: "absolute",
    top: 3,
    width: 12,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.65)",
  },

  dayDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#EDF2EE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },

  dayDotActive: {
    backgroundColor: COLORS.primary,
  },

  chartDay: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "650",
    marginTop: 6,
  },

  chartDayActive: {
    color: COLORS.primary,
    fontWeight: "850",
  },

  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 19,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF3EF",
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 7,
  },

  legendText: {
    color: COLORS.secondary,
    fontSize: 10,
  },

  legendSpacer: {
    flex: 1,
  },

  emptyChartText: {
    textAlign: "center",
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 14,
  },

  recentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
  },

  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 11,
  },

  sessionIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#EAF5ED",
    alignItems: "center",
    justifyContent: "center",
  },

  sessionEmoji: {
    fontSize: 20,
  },

  sessionDetails: {
    flex: 1,
  },

  sessionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },

  sessionSubtitle: {
    fontSize: 10,
    color: COLORS.secondary,
    marginTop: 5,
  },

  sessionStatus: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },

  sessionStatusComplete: {
    backgroundColor: "#E5F5EA",
  },

  sessionStatusIncomplete: {
    backgroundColor: "#FFF1E0",
  },

  sessionStatusText: {
    fontSize: 9,
    fontWeight: "800",
  },

  sessionStatusTextComplete: {
    color: COLORS.primary,
  },

  sessionStatusTextIncomplete: {
    color: "#B87930",
  },

  sessionDivider: {
    height: 1,
    backgroundColor: "#EEF3EF",
  },

  emptySessions: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 15,
  },

  emptySessionsTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 12,
  },

  emptySessionsText: {
    color: COLORS.secondary,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 5,
  },

  insightCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    padding: 18,
    borderRadius: 23,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D8EEDF",
  },

  insightIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },

  insightContent: {
    flex: 1,
  },

  insightHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 6,
  },

  insightTitle: {
    fontSize: 14,
    fontWeight: "850",
    color: COLORS.text,
  },

  insightText: {
    color: "#657A6B",
    fontSize: 12,
    lineHeight: 19,
  },

  footerText: {
    textAlign: "center",
    color: "#8B9A90",
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 8,
  },
});
