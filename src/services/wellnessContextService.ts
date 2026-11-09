
// src/services/wellnessContextService.ts

import {
  getDatabase,
  initializeDatabase,
} from "../database/database";

// ============================================================================
// TYPES
// ============================================================================

export interface WellnessContext {
  wellnessGoal?: string;
  recentMoodSummary?: string;
  recentActivitySummary?: string;
  recentExerciseSummary?: string;
  sleepSummary?: string;
}



interface ProfileRow {
  [key: string]: any;
  wellness_goal: string | null;
}

interface MoodRow {
  [key: string]: any;
  mood: number;
  energy: number | null;
  stress: number | null;
  logged_at: string;
  log_date: string;
}

interface ActivityRow {
  [key: string]: any;
  activity_type: string;
  duration_minutes: number | null;
  completed: number;
  activity_date: string;
}

interface SessionRow {
  [key: string]: any;
  session_type: string | null;
  category: string | null;
  duration_seconds: number | null;
  completed: number;
  completed_at: string | null;
}


// ============================================================================
// HELPERS
// ============================================================================

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return getLocalDateKey(date);
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function moodLabel(value: number): string {
  const labels: Record<number, string> = {
    1: "very low",
    2: "low",
    3: "neutral",
    4: "good",
    5: "very good",
  };

  return labels[value] ?? "unrecorded";
}

function average(values: number[]): number | null {
  const valid = values.filter(
    (value) =>
      Number.isFinite(value) &&
      value >= 1 &&
      value <= 5,
  );

  if (valid.length === 0) {
    return null;
  }

  return (
    valid.reduce((total, value) => total + value, 0) /
    valid.length
  );
}

function describeAverage(
  value: number | null,
  type: "mood" | "energy" | "stress",
): string | null {
  if (value === null) {
    return null;
  }

  const rounded = Math.round(value * 10) / 10;

  if (type === "stress") {
    if (value <= 2) return `low (${rounded}/5)`;
    if (value <= 3.5) return `moderate (${rounded}/5)`;
    return `high (${rounded}/5)`;
  }

  if (value <= 2) return `low (${rounded}/5)`;
  if (value <= 3.5) return `moderate (${rounded}/5)`;

  return `good (${rounded}/5)`;
}

function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// ============================================================================
// PROFILE CONTEXT
// ============================================================================

async function getWellnessGoal(
  userId: string,
): Promise<string | undefined> {
  const db = getDatabase();

  const result = await db.execute<ProfileRow>(
    `SELECT wellness_goal
     FROM profiles
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );

  const goal = cleanText(
    result.rows?._array?.[0]?.wellness_goal,
  );

  return goal || undefined;
}

// ============================================================================
// MOOD CONTEXT
// ============================================================================

async function getRecentMoodSummary(
  userId: string,
): Promise<string | undefined> {
  const db = getDatabase();

  const startDate = getDateDaysAgo(6);

  const result = await db.execute<MoodRow>(
    `SELECT
       mood,
       energy,
       stress,
       note,
       logged_at,
       log_date
     FROM mood_logs
     WHERE user_id = ?
       AND log_date >= ?
     ORDER BY logged_at DESC
     LIMIT 20`,
    [userId, startDate],
  );

  const logs = result.rows?._array ?? [];

  if (logs.length === 0) {
    return undefined;
  }

  const moodAverage = average(
    logs.map((item) => Number(item.mood)),
  );

  const energyAverage = average(
    logs
      .map((item) => item.energy)
      .filter((value): value is number => value !== null)
      .map(Number),
  );

  const stressAverage = average(
    logs
      .map((item) => item.stress)
      .filter((value): value is number => value !== null)
      .map(Number),
  );

  const latest = logs[0];

  const parts: string[] = [
    `The user recorded ${pluralize(logs.length, "mood entry")} in the last 7 days.`,
  ];

  const moodDescription = describeAverage(
    moodAverage,
    "mood",
  );

  const energyDescription = describeAverage(
    energyAverage,
    "energy",
  );

  const stressDescription = describeAverage(
    stressAverage,
    "stress",
  );

  if (moodDescription) {
    parts.push(`Average mood: ${moodDescription}.`);
  }

  if (energyDescription) {
    parts.push(`Average energy: ${energyDescription}.`);
  }

  if (stressDescription) {
    parts.push(`Average stress: ${stressDescription}.`);
  }

  if (Number.isFinite(Number(latest.mood))) {
    parts.push(
      `Most recent mood: ${moodLabel(Number(latest.mood))}.`,
    );
  }

  // Do not send free-text mood notes to Gemini.
  return parts.join(" ");
}

// ============================================================================
// DAILY ACTIVITY CONTEXT
// ============================================================================

async function getRecentActivitySummary(
  userId: string,
): Promise<string | undefined> {
  const db = getDatabase();

  const startDate = getDateDaysAgo(6);

  const result = await db.execute<ActivityRow>(
    `SELECT
       activity_type,
       duration_minutes,
       completed,
       activity_date
     FROM daily_activities
     WHERE user_id = ?
       AND activity_date >= ?
     ORDER BY activity_date DESC
     LIMIT 50`,
    [userId, startDate],
  );

  const activities = result.rows?._array ?? [];

  if (activities.length === 0) {
    return undefined;
  }

  const completedActivities = activities.filter(
    (activity) => Number(activity.completed) === 1,
  );

  const totalMinutes = completedActivities.reduce(
    (total, activity) =>
      total + Math.max(0, Number(activity.duration_minutes) || 0),
    0,
  );

  const activityTypes = Array.from(
    new Set(
      completedActivities
        .map((activity) => cleanText(activity.activity_type))
        .filter(Boolean),
    ),
  ).slice(0, 5);

  const parts = [
    `The user recorded ${pluralize(activities.length, "daily activity")} in the last 7 days.`,
    `${completedActivities.length} marked completed.`,
  ];

  if (totalMinutes > 0) {
    parts.push(
      `Completed activity time: ${totalMinutes} minutes.`,
    );
  }

  if (activityTypes.length > 0) {
    parts.push(
      `Activity types: ${activityTypes.join(", ")}.`,
    );
  }

  return parts.join(" ");
}

// ============================================================================
// EXERCISE CONTEXT
// ============================================================================

async function getRecentExerciseSummary(
  userId: string,
): Promise<string | undefined> {
  const db = getDatabase();

  const startDate = getDateDaysAgo(6);

  const result = await db.execute<SessionRow>(
    `SELECT
       session_type,
       category,
       duration_seconds,
       completed,
       completed_at
     FROM wellness_sessions
     WHERE user_id = ?
       AND completed_at >= ?
     ORDER BY completed_at DESC
     LIMIT 30`,
    [userId, `${startDate}T00:00:00`],
  );

  const sessions = result.rows?._array ?? [];

  if (sessions.length === 0) {
    return undefined;
  }

  const completedSessions = sessions.filter(
    (session) => Number(session.completed) === 1,
  );

  const totalSeconds = completedSessions.reduce(
    (total, session) =>
      total + Math.max(0, Number(session.duration_seconds) || 0),
    0,
  );

  const categories = Array.from(
    new Set(
      completedSessions
        .map((session) =>
          cleanText(session.category || session.session_type),
        )
        .filter(Boolean),
    ),
  ).slice(0, 5);

  const parts = [
    `The user recorded ${pluralize(sessions.length, "wellness session")} in the last 7 days.`,
    `${completedSessions.length} completed.`,
  ];

  if (totalSeconds > 0) {
    parts.push(
      `Total completed session time: ${Math.round(totalSeconds / 60)} minutes.`,
    );
  }

  if (categories.length > 0) {
    parts.push(
      `Session categories: ${categories.join(", ")}.`,
    );
  }

  return parts.join(" ");
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Builds a compact wellness context for the Gemini Edge Function.
 *
 * Only structured wellness summaries are returned.
 *
 * IMPORTANT:
 * - Journal entries are never queried.
 * - Free-text mood notes are not sent.
 * - Personal profile information is not included.
 * - Missing data is simply omitted.
 */
export async function getWellnessContext(
  userId: string,
): Promise<WellnessContext> {
  if (!userId?.trim()) {
    throw new Error("A valid user ID is required.");
  }

  await initializeDatabase();

  const [
    wellnessGoal,
    recentMoodSummary,
    recentActivitySummary,
    recentExerciseSummary,
  ] = await Promise.all([
    getWellnessGoal(userId),
    getRecentMoodSummary(userId),
    getRecentActivitySummary(userId),
    getRecentExerciseSummary(userId),
  ]);

  const context: WellnessContext = {};

  if (wellnessGoal) {
    context.wellnessGoal = wellnessGoal;
  }

  if (recentMoodSummary) {
    context.recentMoodSummary = recentMoodSummary;
  }

  if (recentActivitySummary) {
    context.recentActivitySummary = recentActivitySummary;
  }

  if (recentExerciseSummary) {
    context.recentExerciseSummary = recentExerciseSummary;
  }

  return context;
}

/**
 * Safe wrapper for chat screens.
 *
 * Returns an empty context if local data is temporarily unavailable,
 * allowing the chatbot to continue without personal wellness context.
 */
export async function getWellnessContextSafely(
  userId: string,
): Promise<WellnessContext> {
  try {
    return await getWellnessContext(userId);
  } catch (error) {
    console.warn(
      "[WellnessContextService] Could not load local context:",
      error,
    );

    return {};
  }
}
