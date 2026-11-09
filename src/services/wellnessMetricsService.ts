//src/services/wellnessMetricsService.ts

import { supabase } from "../lib/supabase";
import {
  getDatabase,
  initializeDatabase,
} from "../database/database";

// ============================================================================
// TYPES
// ============================================================================

export type DailyActivityMetric = {
  date: string;
  day: string;
  sessionsCount: number;
  totalMinutes: number;
};

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
    breathingSessions: number;
    totalMinutes: number;
    completionRate: number;
    streakDays: number;
    avgMood: number | null;
  };

  dailyActivity: DailyActivityMetric[];

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

type LocalRow = Record<string, any>;

// ============================================================================
// HELPERS
// ============================================================================

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function asNumber(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function isBreathingSession(session: LocalRow): boolean {
  const values = [
    session.category,
    session.session_type,
    session.exercise_id,
    session.exercise_category,
    session.title,
  ];

  return values.some((value) =>
    String(value ?? "").toLowerCase().includes("breath"),
  );
}

function getLastSevenDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date);
  }

  return dates;
}

function getCompletedSessions(sessions: LocalRow[]): LocalRow[] {
  return sessions.filter((session) => asBoolean(session.completed));
}

function getTodaySessions(sessions: LocalRow[]): LocalRow[] {
  const today = getLocalDateKey(new Date());

  return sessions.filter(
    (session) =>
      session.started_at &&
      getLocalDateKey(new Date(session.started_at)) === today,
  );
}

function buildDailyActivity(
  completedSessions: LocalRow[],
): DailyActivityMetric[] {
  return getLastSevenDates().map((date) => {
    const dateKey = getLocalDateKey(date);

    const matchingSessions = completedSessions.filter(
      (session) =>
        session.started_at &&
        getLocalDateKey(new Date(session.started_at)) === dateKey,
    );

    const totalSeconds = matchingSessions.reduce(
      (sum, session) =>
        sum + Math.max(0, asNumber(session.duration_seconds)),
      0,
    );

    return {
      date: dateKey,
      day: date.toLocaleDateString("en", {
        weekday: "short",
      }),
      sessionsCount: matchingSessions.length,
      totalMinutes: Math.round(totalSeconds / 60),
    };
  });
}

/**
 * Calculates consecutive days with at least one completed session.
 * The streak can continue from yesterday if there is no activity today.
 */
function calculateStreak(sessions: LocalRow[]): number {
  const completedDays = new Set<string>();

  sessions.forEach((session) => {
    if (session.started_at) {
      completedDays.add(
        getLocalDateKey(new Date(session.started_at)),
      );
    }
  });

  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  if (!completedDays.has(getLocalDateKey(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;

  while (completedDays.has(getLocalDateKey(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

function createEmptyMetrics(): WellnessMetrics {
  return {
    todayMood: null,

    todayActivities: {
      total: 0,
      completed: 0,
      totalMinutes: 0,
    },

    weeklyStats: {
      sessionsCount: 0,
      breathingSessions: 0,
      totalMinutes: 0,
      completionRate: 0,
      streakDays: 0,
      avgMood: null,
    },

    dailyActivity: buildDailyActivity([]),
    recentSessions: [],
  };
}

// ============================================================================
// LOCAL METRICS — SQLITE
// ============================================================================

async function fetchLocalWellnessMetrics(
  userId: string,
): Promise<WellnessMetrics> {
  if (!userId) {
    throw new Error("A user ID is required.");
  }

  // Ensure the database and tables exist before querying.
  const db = await initializeDatabase();

  const now = new Date();
  const today = getLocalDateKey(now);

  // Local calendar boundaries converted to ISO timestamps.
  // This keeps the weekly range aligned with the user's timezone.
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const todayStartISO = todayStart.toISOString();
  const tomorrowStartISO = tomorrowStart.toISOString();
  const weekStartISO = weekStart.toISOString();
  const nowISO = now.toISOString();

  // --------------------------------------------------------------------------
  // Today's mood
  // --------------------------------------------------------------------------

  const moodRows = db.execute<LocalRow>(
    `SELECT mood, energy, stress, note, logged_at
     FROM mood_logs
     WHERE user_id = ?
       AND log_date = ?
     ORDER BY logged_at DESC
     LIMIT 1`,
    [userId, today],
  ).rows._array;

  // --------------------------------------------------------------------------
  // Today's activities
  // --------------------------------------------------------------------------

  const activities = db.execute<LocalRow>(
    `SELECT duration_minutes, completed
     FROM daily_activities
     WHERE user_id = ?
       AND activity_date = ?`,
    [userId, today],
  ).rows._array;

  // --------------------------------------------------------------------------
  // Sessions from the last seven calendar days
  // --------------------------------------------------------------------------

  const weekSessions = db.execute<LocalRow>(
    `SELECT
       ws.id,
       ws.exercise_id,
       ws.session_type,
       ws.category,
       ws.duration_seconds,
       ws.completed,
       ws.started_at,
       e.title,
       e.icon,
       e.category AS exercise_category
     FROM wellness_sessions AS ws
     LEFT JOIN exercises AS e
       ON e.id = ws.exercise_id
     WHERE ws.user_id = ?
       AND ws.started_at >= ?
       AND ws.started_at < ?
     ORDER BY ws.started_at DESC`,
    [userId, weekStartISO, nowISO],
  ).rows._array;

  // --------------------------------------------------------------------------
  // All completed sessions — required for the full streak calculation
  // --------------------------------------------------------------------------

  const allCompletedSessions = db.execute<LocalRow>(
    `SELECT started_at
     FROM wellness_sessions
     WHERE user_id = ?
       AND completed = 1
       AND started_at IS NOT NULL
     ORDER BY started_at DESC`,
    [userId],
  ).rows._array;

  // --------------------------------------------------------------------------
  // Mood history for the last seven calendar days
  // --------------------------------------------------------------------------

  const weekMoods = db.execute<LocalRow>(
    `SELECT mood, log_date
     FROM mood_logs
     WHERE user_id = ?
       AND log_date >= ?
       AND log_date <= ?`,
    [userId, getLocalDateKey(weekStart), today],
  ).rows._array;

  // --------------------------------------------------------------------------
  // Five most recent sessions
  // --------------------------------------------------------------------------

  const recentSessions = db.execute<LocalRow>(
    `SELECT
       ws.id,
       ws.exercise_id,
       ws.session_type,
       ws.category,
       ws.duration_seconds,
       ws.completed,
       ws.started_at,
       e.title,
       e.icon,
       e.category AS exercise_category
     FROM wellness_sessions AS ws
     LEFT JOIN exercises AS e
       ON e.id = ws.exercise_id
     WHERE ws.user_id = ?
     ORDER BY ws.started_at DESC
     LIMIT 5`,
    [userId],
  ).rows._array;

  // ==========================================================================
  // CALCULATIONS
  // ==========================================================================

  const completedActivities = activities.filter((activity) =>
    asBoolean(activity.completed),
  );

  const todaySessions = getTodaySessions(weekSessions);
  const completedTodaySessions = getCompletedSessions(todaySessions);
  const completedWeekSessions = getCompletedSessions(weekSessions);

  const todaySeconds = completedTodaySessions.reduce(
    (sum, session) =>
      sum + Math.max(0, asNumber(session.duration_seconds)),
    0,
  );

  const activityMinutes = completedActivities.reduce(
    (sum, activity) =>
      sum + Math.max(0, asNumber(activity.duration_minutes)),
    0,
  );

  const weeklySeconds = completedWeekSessions.reduce(
    (sum, session) =>
      sum + Math.max(0, asNumber(session.duration_seconds)),
    0,
  );

  const breathingSessions = completedWeekSessions.filter(
    isBreathingSession,
  ).length;

  const completionRate =
    weekSessions.length > 0
      ? Math.round(
          (completedWeekSessions.length / weekSessions.length) * 100,
        )
      : 0;

  const avgMood =
    weekMoods.length > 0
      ? Number(
          (
            weekMoods.reduce(
              (sum, item) => sum + asNumber(item.mood),
              0,
            ) / weekMoods.length
          ).toFixed(1),
        )
      : null;

  const todayMinutes =
    todaySeconds > 0
      ? Math.round(todaySeconds / 60)
      : activityMinutes;

  // ==========================================================================
  // RETURN METRICS
  // ==========================================================================

  return {
    todayMood: moodRows.length > 0
      ? {
          mood: moodRows[0].mood ?? null,
          energy: moodRows[0].energy ?? null,
          stress: moodRows[0].stress ?? null,
          note: moodRows[0].note ?? null,
          logged_at: moodRows[0].logged_at ?? null,
        }
      : null,

    todayActivities: {
      total:
        activities.length > 0
          ? activities.length
          : todaySessions.length,

      completed:
        activities.length > 0
          ? completedActivities.length
          : completedTodaySessions.length,

      totalMinutes: Math.round(todayMinutes),
    },

    weeklyStats: {
      sessionsCount: completedWeekSessions.length,
      breathingSessions,
      totalMinutes: Math.round(weeklySeconds / 60),
      completionRate,
      streakDays: calculateStreak(allCompletedSessions),
      avgMood,
    },

    dailyActivity: buildDailyActivity(completedWeekSessions),

    recentSessions: recentSessions.map((session) => ({
      id: String(session.id),
      title: session.title ?? "Wellness session",
      icon: session.icon ?? "🧘",
      category:
        session.category ??
        session.exercise_category ??
        null,
      duration_seconds: asNumber(session.duration_seconds),
      completed: asBoolean(session.completed),
      started_at: session.started_at ?? "",
    })),
  };
}

// ============================================================================
// PUBLIC METRICS API — OFFLINE FIRST
// ============================================================================

/**
 * Progress and Home metrics are read from SQLite.
 *
 * No Supabase request is made here. This means the screen can
 * display locally saved statistics without an internet connection.
 */
export async function fetchWellnessMetrics(
  userId: string,
): Promise<WellnessMetrics> {
  if (!userId) {
    throw new Error("A user ID is required to load wellness metrics.");
  }

  try {
    return await fetchLocalWellnessMetrics(userId);
  } catch (error) {
    console.error(
      "[WellnessMetrics] Local metrics lookup failed:",
      error,
    );

    throw error;
  }
}

// ============================================================================
// FEATURED EXERCISES
// ============================================================================

/**
 * Reads featured exercises from SQLite first.
 * If the local catalogue is empty, it attempts to fetch from Supabase.
 */
export async function fetchFeaturedExercises(limit = 4) {
  const safeLimit = Math.max(
    1,
    Math.min(20, Math.floor(asNumber(limit) || 4)),
  );

  const db = await initializeDatabase();

  try {
    const localExercises = db.execute<LocalRow>(
      `SELECT
         id,
         title,
         description,
         category,
         icon,
         duration_minutes,
         difficulty
       FROM exercises
       WHERE is_active = 1
       ORDER BY created_at DESC
       LIMIT ?`,
      [safeLimit],
    ).rows._array;

    if (localExercises.length > 0) {
      return localExercises;
    }
  } catch (error) {
    console.warn(
      "[Exercises] Could not read local catalogue:",
      error,
    );
  }

  // Only use Supabase when there are no locally saved exercises.
  try {
    const { data, error } = await supabase
      .from("exercises")
      .select(
        `id, title, description, category, icon,
         duration_minutes, difficulty, type, sensor,
         is_active, created_at`,
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw error;
    }

    return data ?? [];
  } catch (error) {
    console.warn(
      "[Exercises] Online catalogue unavailable:",
      error,
    );

    return [];
  }
}
