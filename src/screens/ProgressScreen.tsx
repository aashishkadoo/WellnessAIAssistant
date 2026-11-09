// src/screens/ProgressScreen.tsx


 // src/screens/ProgressScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import {
  Activity,
  ArrowUpRight,
  Award,
  Brain,
  Check,
  Clock3,
  Flame,
  Heart,
  Leaf,
  Moon,
  Sparkles,
  Target,
  TrendingUp,
  Wind,
  Zap,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  user: any;
};

const SCREEN_WIDTH = Dimensions.get("window").width;

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

type StatCardProps = {
  icon: React.ReactNode;
  value: string;
  label: string;
  caption: string;
  accent: string;
  background: string;
};

function StatCard({
  icon,
  value,
  label,
  caption,
  accent,
  background,
}: StatCardProps) {
  return (
    <View style={styles.statCard}>
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

export default function ProgressScreen({ user }: Props) {
  const insets = useSafeAreaInsets();

  // Demo values retained from the original screen.
  // Replace these with values from your wellness metrics service.
  const stats = {
    exercises: 12,
    breathingSessions: 8,
    minutes: 96,
    wellnessScore: 82,
    streak: 7,
  };

  const weeklyActivity = [
    { day: "M", active: true, height: 42 },
    { day: "T", active: true, height: 58 },
    { day: "W", active: true, height: 48 },
    { day: "T", active: false, height: 18 },
    { day: "F", active: true, height: 64 },
    { day: "S", active: true, height: 52 },
    { day: "S", active: false, height: 12 },
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 12) + 10,
            paddingBottom: Math.max(insets.bottom, 12) + 105,
          },
        ]}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <View style={styles.eyebrow}>
              <Sparkles size={14} color={COLORS.primary} />
              <Text style={styles.eyebrowText}>
                YOUR WELLNESS JOURNEY
              </Text>
            </View>

            <Text style={styles.title}>Your progress</Text>
            <Text style={styles.subtitle}>
              Every small step is a step forward.
            </Text>
          </View>

          <LinearGradient
            colors={["#D9F4E3", "#B7E7C9", "#EAF8EF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBadge}
          >
            <Activity size={25} color={COLORS.primary} />
          </LinearGradient>
        </View>

        {/* STREAK HERO */}
        <LinearGradient
          colors={["#226D43", "#2D8956", "#51A977"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakCard}
        >
          <View style={styles.streakGlowOne} />
          <View style={styles.streakGlowTwo} />

          <View style={styles.streakTopRow}>
            <View style={styles.streakPill}>
              <Flame size={14} color="#FFE0A4" />
              <Text style={styles.streakPillText}>
                CURRENT STREAK
              </Text>
            </View>

            <View style={styles.streakAward}>
              <Award size={22} color="#FFE3A7" />
            </View>
          </View>

          <View style={styles.streakMain}>
            <View style={styles.streakNumberWrap}>
              <Text style={styles.streakNumber}>
                {stats.streak}
              </Text>
              <Text style={styles.streakDays}>days</Text>
            </View>

            <View style={styles.streakMessage}>
              <Text style={styles.streakHeadline}>
                You're building a habit!
              </Text>
              <Text style={styles.streakDescription}>
                Keep showing up for yourself. Consistency matters
                more than perfection.
              </Text>
            </View>
          </View>

          <View style={styles.streakFooter}>
            <View style={styles.streakFooterIcon}>
              <Check size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.streakFooterText}>
              One day at a time
            </Text>

            <View style={styles.streakFooterSpacer} />

            <Leaf size={17} color="#C9F1D7" />
          </View>
        </LinearGradient>

        {/* STATISTICS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Your wellness snapshot
            </Text>
            <Text style={styles.sectionSubtitle}>
              A little progress adds up.
            </Text>
          </View>

          <View style={styles.sectionIcon}>
            <TrendingUp size={19} color={COLORS.primary} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon={<Activity size={22} color={COLORS.primary} />}
            value={String(stats.exercises)}
            label="Exercises"
            caption="Sessions completed"
            accent={COLORS.primary}
            background="#E4F5E9"
          />

          <StatCard
            icon={<Wind size={22} color={COLORS.blue} />}
            value={String(stats.breathingSessions)}
            label="Breathing"
            caption="Mindful sessions"
            accent={COLORS.blue}
            background="#EAF1FF"
          />

          <StatCard
            icon={<Clock3 size={22} color={COLORS.orange} />}
            value={String(stats.minutes)}
            label="Minutes"
            caption="Time for yourself"
            accent={COLORS.orange}
            background="#FFF1E0"
          />

          <StatCard
            icon={<Heart size={22} color={COLORS.purple} />}
            value={`${stats.wellnessScore}%`}
            label="Wellness score"
            caption="Personal indicator"
            accent={COLORS.purple}
            background="#F0ECFF"
          />
        </View>

        {/* WEEKLY ACTIVITY */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Weekly activity
            </Text>
            <Text style={styles.sectionSubtitle}>
              Your movement through the week
            </Text>
          </View>

          <View style={styles.weekBadge}>
            <Text style={styles.weekBadgeText}>7 DAYS</Text>
          </View>
        </View>

        <View style={styles.weekCard}>
          <View style={styles.weekSummary}>
            <View>
              <Text style={styles.weekSummaryNumber}>5</Text>
              <Text style={styles.weekSummaryLabel}>
                Active days
              </Text>
            </View>

            <View style={styles.weekSummaryDivider} />

            <View style={styles.weekSummaryRight}>
              <View style={styles.weekTrend}>
                <TrendingUp size={14} color={COLORS.primary} />
                <Text style={styles.weekTrendText}>
                  Keep it up
                </Text>
              </View>
              <Text style={styles.weekSummaryHint}>
                Every session counts
              </Text>
            </View>
          </View>

          <View style={styles.chart}>
            {weeklyActivity.map((item, index) => (
              <View key={`${item.day}-${index}`} style={styles.chartColumn}>
                <View style={styles.barTrack}>
                  <LinearGradient
                    colors={
                      item.active
                        ? ["#75D99B", "#247A4A"]
                        : ["#E9F0EB", "#DDE8E0"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[
                      styles.bar,
                      { height: item.height },
                    ]}
                  />
                  {item.active && (
                    <View style={styles.barHighlight} />
                  )}
                </View>

                <View
                  style={[
                    styles.dayDot,
                    item.active && styles.dayDotActive,
                  ]}
                >
                  {item.active ? (
                    <Check size={10} color="#FFFFFF" />
                  ) : null}
                </View>

                <Text
                  style={[
                    styles.chartDay,
                    item.active && styles.chartDayActive,
                  ]}
                >
                  {item.day}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.chartLegend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>
              Days with activity
            </Text>
            <View style={styles.legendSpacer} />
            <Text style={styles.legendText}>Mon – Sun</Text>
          </View>
        </View>

        {/* WELLNESS INSIGHT */}
        <LinearGradient
          colors={["#F0FAF3", "#E1F4E8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.insightCard}
        >
          <View style={styles.insightIcon}>
            <Brain size={24} color={COLORS.primary} />
          </View>

          <View style={styles.insightContent}>
            <View style={styles.insightHeadingRow}>
              <Text style={styles.insightTitle}>
                A gentle reminder
              </Text>
              <Sparkles size={15} color="#67A97F" />
            </View>

            <Text style={styles.insightText}>
              Wellness isn't a race. Take a moment to breathe,
              stretch, or rest whenever you need it.
            </Text>
          </View>
        </LinearGradient>

        {/* DAILY INTENTION */}
        <View style={styles.intentionCard}>
          <View style={styles.intentionTop}>
            <View style={styles.intentionIcon}>
              <Target size={21} color={COLORS.primary} />
            </View>

            <View style={styles.intentionHeading}>
              <Text style={styles.intentionTitle}>
                Your next small step
              </Text>
              <Text style={styles.intentionSubtitle}>
                Make space for yourself today.
              </Text>
            </View>

            <ArrowUpRight
              size={20}
              color={COLORS.secondary}
            />
          </View>

          <View style={styles.intentionChips}>
            <View style={styles.intentionChip}>
              <Wind size={14} color={COLORS.primary} />
              <Text style={styles.intentionChipText}>
                Breathe
              </Text>
            </View>

            <View style={styles.intentionChip}>
              <Activity size={14} color={COLORS.primary} />
              <Text style={styles.intentionChipText}>
                Move
              </Text>
            </View>

            <View style={styles.intentionChip}>
              <Moon size={14} color={COLORS.primary} />
              <Text style={styles.intentionChipText}>
                Rest
              </Text>
            </View>

            <View style={styles.intentionChip}>
              <Zap size={14} color={COLORS.primary} />
              <Text style={styles.intentionChipText}>
                Recharge
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footerText}>
          Progress at your own pace · Your wellbeing matters 🌿
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
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
    marginBottom: 30,
    gap: 12,
  },

  statCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2,
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
    marginBottom: 22,
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
    minHeight: 7,
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

  intentionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 23,
    padding: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
  },

  intentionTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  intentionIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#E6F5EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  intentionHeading: {
    flex: 1,
  },

  intentionTitle: {
    fontSize: 14,
    fontWeight: "850",
    color: COLORS.text,
  },

  intentionSubtitle: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 4,
  },

  intentionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 17,
  },

  intentionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F8F3",
    borderWidth: 1,
    borderColor: "#E2EFE5",
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 13,
  },

  intentionChipText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "750",
  },

  footerText: {
    textAlign: "center",
    color: "#8B9A90",
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 8,
  },
});
