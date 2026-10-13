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
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import LinearGradient from "react-native-linear-gradient";

import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../services/profileService";
import { moodService } from "../services/moodService";

import {
  fetchWellnessMetrics,
  fetchFeaturedExercises,
  WellnessMetrics,
} from "../services/wellnessMetricsService";


// ============================================================================
// PROPS
// ============================================================================

type Props = {
  user: any;

  onOpenBreathing?: () => void;

  onOpenExercise?: (exercise: any) => void;

  onOpenProgress?: () => void;

  onOpenMood?: () => void;

  // NEW:
  // Opens the Profile screen when the top-right avatar is pressed.
  onOpenProfile?: () => void;

  /**
   * Height of tab bar + chatbot headroom.
   * Used to prevent the ScrollView content from being hidden behind
   * the bottom navigation / floating chatbot.
   */
  bottomOffset?: number;
};


// ============================================================================
// CONSTANTS
// ============================================================================

const MOOD_EMOJIS = [
  "😢",
  "😕",
  "😐",
  "🙂",
  "😄",
];


// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function WellnessHome({
  user,

  onOpenBreathing,

  onOpenExercise,

  onOpenProgress,

  onOpenMood,

  // NEW:
  // Receives the navigation callback from App.tsx.
  onOpenProfile,

  bottomOffset = 88,
}: Props) {

  const insets = useSafeAreaInsets();


  // ==========================================================================
  // STATE
  // ==========================================================================

  const [profile, setProfile] = useState<any>(null);

  const [metrics, setMetrics] =
    useState<WellnessMetrics | null>(null);

  const [featured, setFeatured] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [loggingMood, setLoggingMood] =
    useState(false);


  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  const loadAll = useCallback(async () => {

    try {

      const userId = user?.id;

      if (!userId) {
        return;
      }


      const [
        profileData,
        metricsData,
        featuredData,
      ] = await Promise.all([

        getCurrentProfile(),

        fetchWellnessMetrics(userId),

        fetchFeaturedExercises(4),

      ]);


      setProfile(profileData);

      setMetrics(metricsData);

      setFeatured(featuredData);

    } catch (err) {

      console.error(
        "WellnessHome load error:",
        err
      );

    }

  }, [user?.id]);


  // ==========================================================================
  // INITIAL LOAD
  // ==========================================================================

  useEffect(() => {

    (async () => {

      setLoading(true);

      await loadAll();

      setLoading(false);

    })();

  }, [loadAll]);


  // ==========================================================================
  // REFRESH
  // ==========================================================================

  const onRefresh = async () => {

    setRefreshing(true);

    await loadAll();

    setRefreshing(false);

  };


  // ==========================================================================
  // QUICK MOOD
  // ==========================================================================

  const handleQuickMood = async (
    moodValue: number
  ) => {

    if (
      !user?.id ||
      loggingMood
    ) {
      return;
    }


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


    } catch (e: any) {

      Alert.alert(
        "Couldn't save mood",
        e.message ?? "Try again"
      );


    } finally {

      setLoggingMood(false);

    }

  };


  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  const logout = async () => {

    Alert.alert(
      "Log out?",
      "You can sign back in anytime.",
      [

        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Logout",
          style: "destructive",

          onPress: () =>
            supabase.auth.signOut(),

        },

      ]
    );

  };


  // ==========================================================================
  // LOADING
  // ==========================================================================

  if (
    loading ||
    !metrics
  ) {

    return (

      <SafeAreaView
        style={styles.loadingContainer}
      >

        <ActivityIndicator
          size="large"
          color="#247A4A"
        />

        <Text
          style={styles.loadingText}
        >
          Loading your wellness space...
        </Text>

      </SafeAreaView>

    );

  }


  // ==========================================================================
  // METRICS
  // ==========================================================================

  const {
    todayMood,
    todayActivities,
    weeklyStats,
    recentSessions,
  } = metrics;


  // ==========================================================================
  // USER DISPLAY DATA
  // ==========================================================================

  const firstName =
    profile?.full_name?.split(" ")[0]
      ?? "there";


  const activitiesProgress =
    todayActivities.total > 0
      ? todayActivities.completed /
        todayActivities.total
      : 0;


  const avatarInitial =
    (
      profile?.full_name ??
      user?.email ??
      "U"
    )
      .toString()
      .charAt(0)
      .toUpperCase();


  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (

    <View style={styles.root}>

      <ScrollView

        style={styles.scroll}

        contentContainerStyle={[

          styles.content,

          {

            paddingTop:
              insets.top + 8,

            paddingBottom:
              bottomOffset +
              insets.bottom +
              16,

          },

        ]}

        showsVerticalScrollIndicator={false}

        refreshControl={

          <RefreshControl

            refreshing={refreshing}

            onRefresh={onRefresh}

            tintColor="#247A4A"

            colors={[
              "#247A4A",
            ]}

          />

        }

      >


        {/* ================================================================
            HEADER
            ================================================================ */}

        <View style={styles.header}>

          <View
            style={{ flex: 1 }}
          >

            <Text
              style={styles.hello}
            >
              Hello, {firstName} 👋
            </Text>

            <Text
              style={styles.subtitle}
            >

              {todayMood

                ? "Great job checking in today."

                : "How are you feeling right now?"

              }

            </Text>

          </View>


          {/* ============================================================
              PROFILE AVATAR

              BEFORE:
                onPress={logout}

              NOW:
                onPress={onOpenProfile}

              This sends the user to ProfileScreen through App.tsx.
              ============================================================ */}

          <TouchableOpacity

            style={styles.avatar}

            onPress={onOpenProfile}

            activeOpacity={0.85}

            accessibilityRole="button"

            accessibilityLabel="Open profile"

          >

            <Text
              style={styles.avatarText}
            >
              {avatarInitial}
            </Text>

          </TouchableOpacity>

        </View>


        {/* ================================================================
            HERO — QUICK MOOD
            ================================================================ */}

        <LinearGradient

          colors={[
            "#E6F4EC",
            "#D2EEE0",
          ]}

          start={{
            x: 0,
            y: 0,
          }}

          end={{
            x: 1,
            y: 1,
          }}

          style={styles.hero}

        >

          <View
            style={styles.heroTopRow}
          >

            <View
              style={{ flex: 1 }}
            >

              <Text
                style={styles.heroTitle}
              >
                How's your mood?
              </Text>

              <Text
                style={styles.heroSub}
              >

                {todayMood

                  ? `Logged today · Energy ${
                      todayMood.energy ?? "-"
                    } · Stress ${
                      todayMood.stress ?? "-"
                    }`

                  : "Tap an emoji to log instantly"

                }

              </Text>

            </View>


            {todayMood ? (

              <View
                style={styles.moodTodayChip}
              >

                <Text
                  style={styles.moodTodayEmoji}
                >

                  {
                    MOOD_EMOJIS[
                      todayMood.mood - 1
                    ]
                  }

                </Text>

              </View>

            ) : null}

          </View>


          <View
            style={styles.moodRow}
          >

            {MOOD_EMOJIS.map(
              (emoji, i) => {

                const value =
                  i + 1;

                const selected =
                  todayMood?.mood ===
                  value;


                return (

                  <TouchableOpacity

                    key={value}

                    disabled={
                      loggingMood
                    }

                    onPress={() =>
                      handleQuickMood(
                        value
                      )
                    }

                    style={[
                      styles.moodBtn,

                      selected &&
                        styles.moodBtnSelected,

                    ]}

                    activeOpacity={0.75}

                  >

                    <Text
                      style={styles.moodEmoji}
                    >
                      {emoji}
                    </Text>

                  </TouchableOpacity>

                );

              }
            )}

          </View>

        </LinearGradient>


        {/* ================================================================
            METRICS
            ================================================================ */}

        <View
          style={styles.metricsRow}
        >

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor:
                  "#E6F4EC",
              },
            ]}
          >

            <Text
              style={styles.metricIcon}
            >
              🔥
            </Text>

            <Text
              style={styles.metricValue}
            >
              {weeklyStats.streakDays}
            </Text>

            <Text
              style={styles.metricLabel}
            >
              Day streak
            </Text>

          </View>


          <View
            style={[
              styles.metricCard,
              {
                backgroundColor:
                  "#EAF1FF",
              },
            ]}
          >

            <Text
              style={styles.metricIcon}
            >
              ⏱️
            </Text>

            <Text
              style={styles.metricValue}
            >
              {weeklyStats.totalMinutes}
            </Text>

            <Text
              style={styles.metricLabel}
            >
              Min this wk
            </Text>

          </View>


          <View
            style={[
              styles.metricCard,
              {
                backgroundColor:
                  "#FFF4E6",
              },
            ]}
          >

            <Text
              style={styles.metricIcon}
            >
              😊
            </Text>

            <Text
              style={styles.metricValue}
            >
              {weeklyStats.avgMood ?? "-"}
            </Text>

            <Text
              style={styles.metricLabel}
            >
              Avg mood
            </Text>

          </View>

        </View>


        {/* ================================================================
            TODAY'S PROGRESS
            ================================================================ */}

        <View
          style={styles.card}
        >

          <View
            style={styles.cardHeaderRow}
          >

            <Text
              style={styles.cardTitle}
            >
              Today's Progress
            </Text>

            <Text
              style={styles.cardHint}
            >
              {todayActivities.completed}/
              {todayActivities.total || 0}
            </Text>

          </View>


          <View
            style={styles.progressTrack}
          >

            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    Math.min(
                      activitiesProgress *
                        100,
                      100
                    )
                  }%`,
                },
              ]}
            />

          </View>


          <View
            style={styles.progressMetaRow}
          >

            <Text
              style={styles.textSmall}
            >
              {todayActivities.totalMinutes}
              {" "}min completed
            </Text>

            <Text
              style={styles.textSmall}
            >
              {weeklyStats.sessionsCount}
              {" "}sessions ·{" "}
              {weeklyStats.completionRate}%
            </Text>

          </View>

        </View>


        {/* ================================================================
            QUICK ACTIONS
            ================================================================ */}

        <View
          style={styles.card}
        >

          <Text
            style={styles.cardTitle}
          >
            Quick actions
          </Text>


          <View
            style={styles.actionsGrid}
          >

            <ActionTile
              icon="🌿"
              label="Breathing"
              onPress={onOpenBreathing}
            />

            <ActionTile
              icon="📊"
              label="Progress"
              onPress={onOpenProgress}
            />

            <ActionTile
              icon="😊"
              label="Log mood"
              onPress={onOpenMood}
            />

            <ActionTile
              icon="📓"
              label="Exercise"
              onPress={() =>
                featured[0]
                  ? onOpenExercise?.(
                      featured[0]
                    )
                  : undefined
              }
            />

          </View>

        </View>


        {/* ================================================================
            RECENT SESSIONS
            ================================================================ */}

        <View
          style={styles.card}
        >

          <View
            style={styles.cardHeaderRow}
          >

            <Text
              style={styles.cardTitle}
            >
              Recent sessions
            </Text>


            {onOpenProgress ? (

              <TouchableOpacity
                onPress={onOpenProgress}
              >

                <Text
                  style={styles.cardLink}
                >
                  See all
                </Text>

              </TouchableOpacity>

            ) : null}

          </View>


          {recentSessions.length === 0 ? (

            <View
              style={styles.emptyState}
            >

              <Text
                style={styles.emptyIcon}
              >
                ✨
              </Text>

              <Text
                style={styles.emptyText}
              >
                No sessions yet.
                Start one below.
              </Text>

            </View>

          ) : (

            recentSessions.map(
              (s, idx) => (

                <View

                  key={s.id}

                  style={[

                    styles.sessionRow,

                    idx ===
                      recentSessions.length - 1 &&
                      {
                        borderBottomWidth: 0,
                      },

                  ]}

                >

                  <Text
                    style={styles.sessionIcon}
                  >
                    {s.icon ?? "🧘"}
                  </Text>


                  <View
                    style={{ flex: 1 }}
                  >

                    <Text
                      style={styles.sessionTitle}
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>

                    <Text
                      style={styles.sessionMeta}
                    >

                      {
                        new Date(
                          s.started_at
                        ).toLocaleDateString()
                      }

                      {" · "}

                      {
                        Math.round(
                          s.duration_seconds /
                            60
                        )
                      }

                      {" "}min

                    </Text>

                  </View>


                  <View
                    style={[
                      styles.sessionBadge,

                      s.completed
                        ? styles.badgeSuccess
                        : styles.badgePending,

                    ]}
                  >

                    <Text
                      style={[
                        styles.sessionBadgeText,

                        s.completed
                          ? styles.badgeSuccessText
                          : styles.badgePendingText,

                      ]}
                    >

                      {s.completed
                        ? "Done"
                        : "Open"}

                    </Text>

                  </View>

                </View>

              )
            )

          )}

        </View>


        {/* ================================================================
            RECOMMENDED
            ================================================================ */}

        {featured.length > 0 && (

          <View
            style={styles.card}
          >

            <Text
              style={styles.cardTitle}
            >
              Recommended for you
            </Text>


            {featured.map(
              (ex) => (

                <TouchableOpacity

                  key={ex.id}

                  style={styles.exerciseRow}

                  onPress={() =>
                    onOpenExercise?.(ex)
                  }

                  activeOpacity={0.7}

                >

                  <View
                    style={
                      styles.exerciseIconBubble
                    }
                  >

                    <Text
                      style={styles.sessionIcon}
                    >
                      {ex.icon ?? "🧘"}
                    </Text>

                  </View>


                  <View
                    style={{ flex: 1 }}
                  >

                    <Text
                      style={styles.sessionTitle}
                      numberOfLines={1}
                    >
                      {ex.title}
                    </Text>

                    <Text
                      style={styles.sessionMeta}
                      numberOfLines={1}
                    >

                      {ex.category}

                      {
                        ex.duration_minutes
                          ? ` · ${ex.duration_minutes} min`
                          : ""
                      }

                      {
                        ex.difficulty
                          ? ` · ${ex.difficulty}`
                          : ""
                      }

                    </Text>

                  </View>


                  <Text
                    style={styles.chevron}
                  >
                    ›
                  </Text>

                </TouchableOpacity>

              )
            )}

          </View>

        )}


        {/* ================================================================
            ACCOUNT
            ================================================================ */}

        <View
          style={styles.card}
        >

          <Text
            style={styles.cardTitle}
          >
            Your account
          </Text>


          <View
            style={styles.accountRow}
          >

            <Text
              style={styles.accountIcon}
            >
              ✉️
            </Text>

            <Text
              style={styles.text}
              numberOfLines={1}
            >
              {profile?.email ||
                user?.email}
            </Text>

          </View>


          <View
            style={styles.accountRow}
          >

            <Text
              style={styles.accountIcon}
            >
              🎯
            </Text>

            <Text
              style={styles.text}
              numberOfLines={1}
            >
              {
                profile?.wellness_goal ||
                "No wellness goal set"
              }
            </Text>

          </View>

        </View>


        {/* ================================================================
            LOGOUT
            ================================================================ */}

        <TouchableOpacity

          style={styles.logout}

          onPress={logout}

          activeOpacity={0.85}

        >

          <Text
            style={styles.logoutIcon}
          >
            🚪
          </Text>

          <Text
            style={styles.logoutText}
          >
            Log out
          </Text>

        </TouchableOpacity>


      </ScrollView>

    </View>

  );

}


// ============================================================================
// ACTION TILE
// ============================================================================

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
}) {

  if (!onPress) {
    return null;
  }


  return (

    <TouchableOpacity

      style={styles.actionTile}

      onPress={onPress}

      activeOpacity={0.75}

    >

      <View
        style={styles.actionIconWrap}
      >

        <Text
          style={styles.actionEmoji}
        >
          {icon}
        </Text>

      </View>


      <Text
        style={styles.actionLabel}
      >
        {label}
      </Text>

    </TouchableOpacity>

  );

}


// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: "#F4F8F5",
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },


  // --------------------------------------------------------------------------
  // LOADING
  // --------------------------------------------------------------------------

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F8F5",
  },

  loadingText: {
    marginTop: 15,
    color: "#68756D",
  },


  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  hello: {
    fontSize: 24,
    fontWeight: "800",
    color: "#247A4A",
  },

  subtitle: {
    marginTop: 4,
    color: "#68756D",
    fontSize: 13,
  },


  // --------------------------------------------------------------------------
  // PROFILE AVATAR
  // --------------------------------------------------------------------------

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,

    backgroundColor: "#247A4A",

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 12,
  },

  avatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },


  // --------------------------------------------------------------------------
  // HERO
  // --------------------------------------------------------------------------

  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  heroTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#247A4A",
  },

  heroSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#526158",
  },

  moodTodayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,

    backgroundColor: "#fff",

    alignItems: "center",
    justifyContent: "center",

    marginLeft: 12,
  },

  moodTodayEmoji: {
    fontSize: 24,
  },

  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  moodBtn: {
    flex: 1,

    marginHorizontal: 3,

    paddingVertical: 10,

    borderRadius: 14,

    alignItems: "center",

    backgroundColor:
      "rgba(255,255,255,0.75)",
  },

  moodBtnSelected: {
    backgroundColor: "#247A4A",
  },

  moodEmoji: {
    fontSize: 22,
  },


  // --------------------------------------------------------------------------
  // METRICS
  // --------------------------------------------------------------------------

  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  metricCard: {
    flex: 1,

    paddingVertical: 14,
    paddingHorizontal: 10,

    borderRadius: 16,

    alignItems: "center",
  },

  metricIcon: {
    fontSize: 20,
  },

  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#247A4A",
    marginTop: 6,
  },

  metricLabel: {
    marginTop: 2,
    fontSize: 11,
    color: "#526158",
    textAlign: "center",
  },


  // --------------------------------------------------------------------------
  // GENERIC CARD
  // --------------------------------------------------------------------------

  card: {
    backgroundColor: "#fff",

    padding: 16,

    marginVertical: 8,

    borderRadius: 18,

    shadowColor: "#000",

    shadowOpacity: 0.04,

    shadowRadius: 6,

    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 1,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#247A4A",
    marginBottom: 10,
  },

  cardHint: {
    fontSize: 12,
    color: "#8A968E",
    marginBottom: 10,
  },

  cardLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#247A4A",
    marginBottom: 10,
  },

  text: {
    flex: 1,
    color: "#526158",
    fontSize: 13,
    marginLeft: 8,
  },

  textSmall: {
    color: "#8A968E",
    fontSize: 12,
  },


  // --------------------------------------------------------------------------
  // PROGRESS
  // --------------------------------------------------------------------------

  progressTrack: {
    height: 8,

    backgroundColor: "#E8EEEA",

    borderRadius: 4,

    overflow: "hidden",

    marginVertical: 4,
  },

  progressFill: {
    height: 8,

    backgroundColor: "#247A4A",

    borderRadius: 4,
  },

  progressMetaRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    marginTop: 10,
  },


  // --------------------------------------------------------------------------
  // QUICK ACTIONS
  // --------------------------------------------------------------------------

  actionsGrid: {
    flexDirection: "row",

    flexWrap: "wrap",

    justifyContent: "space-between",

    marginTop: 4,

    rowGap: 10,
  },

  actionTile: {
    width: "48%",

    minHeight: 58,

    backgroundColor: "#F1F7F3",

    borderRadius: 14,

    paddingHorizontal: 12,

    paddingVertical: 12,

    flexDirection: "row",

    alignItems: "center",
  },

  actionIconWrap: {
    width: 34,

    height: 34,

    borderRadius: 17,

    backgroundColor: "#fff",

    alignItems: "center",

    justifyContent: "center",

    flexShrink: 0,
  },

  actionEmoji: {
    fontSize: 18,
  },

  actionLabel: {
    color: "#247A4A",

    fontWeight: "700",

    fontSize: 13,

    marginLeft: 10,

    flex: 1,

    flexShrink: 1,
  },


  // --------------------------------------------------------------------------
  // SESSIONS
  // --------------------------------------------------------------------------

  sessionRow: {
    flexDirection: "row",

    alignItems: "center",

    paddingVertical: 12,

    borderBottomWidth:
      StyleSheet.hairlineWidth,

    borderBottomColor: "#EEF2EF",

    gap: 10,
  },

  sessionIcon: {
    fontSize: 20,
  },

  sessionTitle: {
    fontSize: 14,

    fontWeight: "600",

    color: "#2F3A33",
  },

  sessionMeta: {
    fontSize: 12,

    color: "#8A968E",

    marginTop: 2,
  },

  sessionBadge: {
    paddingHorizontal: 10,

    paddingVertical: 4,

    borderRadius: 10,
  },

  sessionBadgeText: {
    fontSize: 11,

    fontWeight: "700",
  },

  badgeSuccess: {
    backgroundColor: "#D7EEE1",
  },

  badgeSuccessText: {
    color: "#247A4A",
  },

  badgePending: {
    backgroundColor: "#FFF1D6",
  },

  badgePendingText: {
    color: "#A76B00",
  },


  // --------------------------------------------------------------------------
  // RECOMMENDED
  // --------------------------------------------------------------------------

  exerciseRow: {
    flexDirection: "row",

    alignItems: "center",

    paddingVertical: 12,

    gap: 12,
  },

  exerciseIconBubble: {
    width: 40,

    height: 40,

    borderRadius: 20,

    backgroundColor: "#F1F7F3",

    alignItems: "center",

    justifyContent: "center",
  },

  chevron: {
    fontSize: 22,

    color: "#B8C3BC",
  },


  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------

  emptyState: {
    alignItems: "center",

    paddingVertical: 18,

    gap: 6,
  },

  emptyIcon: {
    fontSize: 22,
  },

  emptyText: {
    fontSize: 12,

    color: "#8A968E",
  },


  // --------------------------------------------------------------------------
  // ACCOUNT
  // --------------------------------------------------------------------------

  accountRow: {
    flexDirection: "row",

    alignItems: "center",

    marginVertical: 4,
  },

  accountIcon: {
    fontSize: 15,

    width: 22,

    textAlign: "center",
  },


  // --------------------------------------------------------------------------
  // LOGOUT
  // --------------------------------------------------------------------------

  logout: {
    marginTop: 16,

    backgroundColor: "#E6F4EC",

    padding: 15,

    alignItems: "center",

    justifyContent: "center",

    flexDirection: "row",

    gap: 8,

    borderRadius: 18,

    borderWidth: 1,

    borderColor: "#C7E3D5",
  },

  logoutIcon: {
    fontSize: 16,
  },

  logoutText: {
    color: "#247A4A",

    fontWeight: "800",
  },

});