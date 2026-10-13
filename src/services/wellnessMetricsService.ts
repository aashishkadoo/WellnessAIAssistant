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

export async function fetchWellnessMetrics(userId: string): Promise<WellnessMetrics> {
  const today = new Date().toISOString().split("T")[0];

  // Week start (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoISO = weekAgo.toISOString();

  const [
    moodTodayRes,
    activitiesTodayRes,
    weekSessionsRes,
    weekMoodsRes,
    recentSessionsRes,
  ] = await Promise.all([
    supabase
      .from("mood_logs")
      .select("mood, energy, stress, note, logged_at")
      .eq("user_id", userId)
      .eq("log_date", today)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("daily_activities")
      .select("duration_minutes, completed")
      .eq("user_id", userId)
      .eq("activity_date", today),

    supabase
      .from("wellness_sessions")
      .select("duration_seconds, completed, started_at")
      .eq("user_id", userId)
      .gte("started_at", weekAgoISO),

    supabase
      .from("mood_logs")
      .select("mood, log_date")
      .eq("user_id", userId)
      .gte("log_date", weekAgo.toISOString().split("T")[0]),

    supabase
      .from("wellness_sessions")
      .select(
        `id, duration_seconds, completed, started_at, category,
         exercises ( title, icon )`
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  // -------- Today activities --------
  const activities = activitiesTodayRes.data ?? [];
  const completedActivities = activities.filter((a) => a.completed);

  // -------- Weekly sessions --------
  const weekSessions = weekSessionsRes.data ?? [];
  const completedSessions = weekSessions.filter((s) => s.completed);
  const totalSeconds = completedSessions.reduce(
    (sum, s) => sum + (s.duration_seconds ?? 0),
    0
  );

  const completionRate =
    weekSessions.length > 0
      ? Math.round((completedSessions.length / weekSessions.length) * 100)
      : 0;

  // -------- Streak: consecutive days with a completed session --------
  const completedDays = new Set(
    completedSessions.map((s) => s.started_at.split("T")[0])
  );
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (completedDays.has(key)) streak++;
    else if (i > 0) break; // allow today missing, break streak if yesterday missing too
  }

  // -------- Avg mood this week --------
  const weekMoods = weekMoodsRes.data ?? [];
  const avgMood =
    weekMoods.length > 0
      ? Number(
          (
            weekMoods.reduce((sum, m) => sum + m.mood, 0) / weekMoods.length
          ).toFixed(1)
        )
      : null;

  // -------- Recent sessions (normalize) --------
  const recentSessions = (recentSessionsRes.data ?? []).map((s: any) => ({
    id: s.id,
    title: s.exercises?.title ?? "Session",
    icon: s.exercises?.icon ?? "🧘",
    category: s.category,
    duration_seconds: s.duration_seconds ?? 0,
    completed: s.completed,
    started_at: s.started_at,
  }));

  return {
    todayMood: moodTodayRes.data ?? null,
    todayActivities: {
      total: activities.length,
      completed: completedActivities.length,
      totalMinutes: completedActivities.reduce(
        (sum, a) => sum + (a.duration_minutes ?? 0),
        0
      ),
    },
    weeklyStats: {
      sessionsCount: completedSessions.length,
      totalMinutes: Math.round(totalSeconds / 60),
      completionRate,
      streakDays: streak,
      avgMood,
    },
    recentSessions,
  };
}

// -------- Featured exercises --------
export async function fetchFeaturedExercises(limit = 4) {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, title, description, category, icon, duration_minutes, difficulty")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}