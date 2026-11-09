// src/database/schema.ts


export const DATABASE_SCHEMA = `
  PRAGMA foreign_keys = ON;

  -- Application metadata
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );

  -- Cached user profile
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    wellness_goal TEXT,
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    synced INTEGER NOT NULL DEFAULT 1
  );

  -- Exercise catalogue
  CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT,
    duration_minutes INTEGER,
    difficulty TEXT,
    type TEXT NOT NULL,
    sensor TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT,
    synced INTEGER NOT NULL DEFAULT 1
  );

  -- Daily activity tracking
  CREATE TABLE IF NOT EXISTS daily_activities (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_date TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    synced INTEGER NOT NULL DEFAULT 0
  );

  -- Completed and in-progress wellness sessions
  CREATE TABLE IF NOT EXISTS wellness_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    exercise_id TEXT,
    session_type TEXT NOT NULL,
    category TEXT,
    duration_seconds INTEGER DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    mood_before INTEGER,
    mood_after INTEGER,
    notes TEXT,
    metadata TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT,
    synced INTEGER NOT NULL DEFAULT 0
  );

  -- Private journal entries
  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    mood INTEGER,
    tags TEXT,
    prompt TEXT,
    is_private INTEGER NOT NULL DEFAULT 1,
    created_at TEXT,
    updated_at TEXT,
    synced INTEGER NOT NULL DEFAULT 0
  );

  -- Mood tracking
  CREATE TABLE IF NOT EXISTS mood_logs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
    energy INTEGER CHECK (energy BETWEEN 1 AND 5),
    stress INTEGER CHECK (stress BETWEEN 1 AND 5),
    note TEXT,
    logged_at TEXT,
    log_date TEXT,
    synced INTEGER NOT NULL DEFAULT 0
  );

  -- Yoga video metadata
  CREATE TABLE IF NOT EXISTS yoga_videos (
    id TEXT PRIMARY KEY NOT NULL,
    exercise_id TEXT,
    youtube_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel TEXT,
    duration_seconds INTEGER,
    difficulty TEXT,
    focus_area TEXT,
    thumbnail_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT,
    synced INTEGER NOT NULL DEFAULT 1
  );

  -- Audio and video metadata
  CREATE TABLE IF NOT EXISTS media_items (
    id TEXT PRIMARY KEY NOT NULL,
    exercise_id TEXT,
    media_type TEXT NOT NULL
      CHECK (media_type IN ('youtube', 'audio', 'video')),
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    autoplay INTEGER NOT NULL DEFAULT 1,
    loop INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT,
    synced INTEGER NOT NULL DEFAULT 1
  );

  -- Instructions for individual exercises
  CREATE TABLE IF NOT EXISTS exercise_steps (
    id TEXT PRIMARY KEY NOT NULL,
    exercise_id TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    instruction TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    animation_key TEXT,
    voice_prompt TEXT,
    created_at TEXT,
    synced INTEGER NOT NULL DEFAULT 1
  );

  -- Offline changes waiting to be uploaded
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    operation TEXT NOT NULL
      CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'processing', 'failed')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_activities_user_date
    ON daily_activities(user_id, activity_date);

  CREATE INDEX IF NOT EXISTS idx_sessions_user_started
    ON wellness_sessions(user_id, started_at);

  CREATE INDEX IF NOT EXISTS idx_journal_user_created
    ON journal_entries(user_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_mood_user_date
    ON mood_logs(user_id, log_date);

  CREATE INDEX IF NOT EXISTS idx_sync_queue_status
    ON sync_queue(status, created_at);

  CREATE INDEX IF NOT EXISTS idx_sync_queue_record
    ON sync_queue(table_name, record_id);
`;
