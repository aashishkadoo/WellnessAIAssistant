//src/services/wellnessMetricsService.ts


import { supabase } from "../lib/supabase";

export type WellnessMetrics = {
  todayMood: {
    mood: number | null;
    energy: number | null;
    stress: number | null;
    note: string | null;
    logged_at: string | null;
  } | null;

  todayActivities: {
    total: number;
    completed: number;
    totalMinutes: number;
  };

  weeklyStats: {
    sessionsCount: number;
    totalMinutes: number;
    completionRate: number;
    streakDays: number;
    avgMood: number | null;
  };

  recentSessions: Array<{
    id: string;
    title: string;
    icon: string | null;
    category: string | null;
    duration_seconds: number;
    completed: boolean;
    started_at: string;
  }>;
};

// Use local calendar dates instead of UTC date strings.
function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLocalDayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    dateKey: getLocalDateKey(start),
  };
}

export async function fetchWellnessMetrics(
  userId: string,
): Promise<WellnessMetrics> {
  const now = new Date();
  const today = getLocalDayBounds(now);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const weekStartDate = getLocalDateKey(weekStart);
  const weekStartISO = weekStart.toISOString();

  const [
    moodTodayRes,
    activitiesTodayRes,
    todaySessionsRes,
    weekSessionsRes,
    weekMoodsRes,
    recentSessionsRes,
  ] = await Promise.all([
    supabase
      .from("mood_logs")
      .select("mood, energy, stress, note, logged_at")
      .eq("user_id", userId)
      .eq("log_date", today.dateKey)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("daily_activities")
      .select("duration_minutes, completed")
      .eq("user_id", userId)
      .eq("activity_date", today.dateKey),

    // Primary source for today's completed exercise time.
    supabase
      .from("wellness_sessions")
      .select("id, duration_seconds, completed, started_at")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("started_at", today.startISO)
      .lt("started_at", today.endISO),

    supabase
      .from("wellness_sessions")
      .select("duration_seconds, completed, started_at")
      .eq("user_id", userId)
      .gte("started_at", weekStartISO)
      .lt("started_at", now.toISOString()),

    supabase
      .from("mood_logs")
      .select("mood, log_date")
      .eq("user_id", userId)
      .gte("log_date", weekStartDate)
      .lte("log_date", today.dateKey),

    supabase
      .from("wellness_sessions")
      .select(
        `id, duration_seconds, completed, started_at, category,
         exercises ( title, icon )`,
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  // Surface database failures rather than silently displaying false zeros.
  const results = [
    moodTodayRes,
    activitiesTodayRes,
    todaySessionsRes,
    weekSessionsRes,
    weekMoodsRes,
    recentSessionsRes,
  ];

  const failedQuery = results.find((result) => result.error);

  if (failedQuery?.error) {
    throw failedQuery.error;
  }

  const activities = activitiesTodayRes.data ?? [];
  const completedActivities = activities.filter((activity) => activity.completed);

  const todaySessions = todaySessionsRes.data ?? [];
  const weekSessions = weekSessionsRes.data ?? [];
  const completedWeekSessions = weekSessions.filter(
    (session) => session.completed,
  );

  // Count exercise minutes from completed sessions first.
  // Fall back to daily_activities when session duration is not available.
  // Do NOT add both sources together: they may represent the same exercise.
  const completedSessionSeconds = todaySessions.reduce(
    (sum, session) => sum + Math.max(0, session.duration_seconds ?? 0),
    0,
  );

  const activityMinutes = completedActivities.reduce(
    (sum, activity) => sum + Math.max(0, activity.duration_minutes ?? 0),
    0,
  );

  const sessionMinutes = Math.round(completedSessionSeconds / 60);

  const todayMinutes =
    completedSessionSeconds > 0 ? sessionMinutes : activityMinutes;

  // Weekly totals.
  const weeklySeconds = completedWeekSessions.reduce(
    (sum, session) => sum + Math.max(0, session.duration_seconds ?? 0),
    0,
  );

  const completionRate =
    weekSessions.length > 0
      ? Math.round(
          (completedWeekSessions.length / weekSessions.length) * 100,
        )
      : 0;

  // Consecutive local calendar days containing completed sessions.
  const completedDays = new Set(
    completedWeekSessions.map((session) =>
      getLocalDateKey(new Date(session.started_at)),
    ),
  );

  let streak = 0;

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    if (completedDays.has(getLocalDateKey(date))) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // Average mood over the last seven calendar days.
  const weekMoods = weekMoodsRes.data ?? [];

  const avgMood =
    weekMoods.length > 0
      ? Number(
          (
            weekMoods.reduce((sum, mood) => sum + mood.mood, 0) /
            weekMoods.length
          ).toFixed(1),
        )
      : null;

  // Normalize recent sessions for the existing Home UI.
  const recentSessions = (recentSessionsRes.data ?? []).map((session: any) => {
    const exercise = Array.isArray(session.exercises)
      ? session.exercises[0]
      : session.exercises;

    return {
      id: session.id,
      title: exercise?.title ?? "Wellness session",
      icon: exercise?.icon ?? "🧘",
      category: session.category ?? null,
      duration_seconds: session.duration_seconds ?? 0,
      completed: Boolean(session.completed),
      started_at: session.started_at,
    };
  });

  return {
    todayMood: moodTodayRes.data ?? null,

    todayActivities: {
      // Use session counts if activity rows were never created.
      total: activities.length > 0 ? activities.length : todaySessions.length,
      completed:
        activities.length > 0
          ? completedActivities.length
          : todaySessions.length,
      totalMinutes: todayMinutes,
    },

    weeklyStats: {
      sessionsCount: completedWeekSessions.length,
      totalMinutes: Math.round(weeklySeconds / 60),
      completionRate,
      streakDays: streak,
      avgMood,
    },

    recentSessions,
  };
}

export async function fetchFeaturedExercises(limit = 4) {
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, title, description, category, icon, duration_minutes, difficulty",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data ?? [];
}
