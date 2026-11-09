// src/services/exerciseService.ts
import { supabase } from "../lib/supabase";
import { getDatabase } from "../database/database";

// ============================================================================
// TYPES
// ============================================================================

export type Exercise = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string | null;
  duration_minutes: number | null;
  difficulty: string | null;
  type: string;
  sensor: string | null;
  is_active: boolean;
  created_at: string;
};

type CatalogData = {
  exercises: any[];
  steps: any[];
  media: any[];
  videos: any[];
};

export type ExerciseCatalogItem = Exercise & {
  yoga_video: any | null;
  audio_tracks: any[];
  has_steps: boolean;
};

type SqlRow = Record<string, any>;

// ============================================================================
// HELPERS
// ============================================================================

const boolToInt = (value: unknown): number =>
  value === true || value === 1 || value === "1" ? 1 : 0;

const parseBool = (value: unknown): boolean =>
  value === true || value === 1 || value === "1";

function rows<T extends SqlRow>(
  sql: string,
  params: unknown[] = [],
): T[] {
  const db = getDatabase();

  const result = db.execute<T>(
    sql,
    params as any[],
  );

  return result.rows?._array ?? [];
}

function saveMeta(key: string, value: string): void {
  getDatabase().execute(
    `INSERT OR REPLACE INTO app_meta (key, value)
     VALUES (?, ?)`,
    [key, value],
  );
}

function getMeta(key: string): string | null {
  const result = rows<{ value: string }>(
    `SELECT value
     FROM app_meta
     WHERE key = ?
     LIMIT 1`,
    [key],
  );

  return result[0]?.value ?? null;
}

// ============================================================================
// REMOTE CATALOGUE
// ============================================================================

async function fetchRemoteCatalog(): Promise<CatalogData> {
  const {
    data: exercises,
    error: exerciseError,
  } = await supabase
    .from("exercises")
    .select("*")
    .eq("is_active", true)
    .order("title", { ascending: true });

  if (exerciseError) {
    throw exerciseError;
  }

  const exerciseRows = exercises ?? [];

  const ids = exerciseRows.map((item) => item.id);

  if (ids.length === 0) {
    return {
      exercises: [],
      steps: [],
      media: [],
      videos: [],
    };
  }

  const [
    stepsResult,
    mediaResult,
    videosResult,
  ] = await Promise.all([
    supabase
      .from("exercise_steps")
      .select("*")
      .in("exercise_id", ids)
      .order("step_order", { ascending: true }),

    supabase
      .from("media_items")
      .select("*")
      .in("exercise_id", ids)
      .eq("is_active", true),

    supabase
      .from("yoga_videos")
      .select("*")
      .in("exercise_id", ids)
      .eq("is_active", true),
  ]);

  if (stepsResult.error) {
    throw stepsResult.error;
  }

  if (mediaResult.error) {
    throw mediaResult.error;
  }

  if (videosResult.error) {
    throw videosResult.error;
  }

  return {
    exercises: exerciseRows,
    steps: stepsResult.data ?? [],
    media: mediaResult.data ?? [],
    videos: videosResult.data ?? [],
  };
}

// ============================================================================
// OFFLINE CATALOGUE CACHE
// ============================================================================

function cacheCatalog(catalog: CatalogData): void {
  const db = getDatabase();

  // Save exercises.
  for (const item of catalog.exercises) {
    db.execute(
      `INSERT OR REPLACE INTO exercises
       (
         id,
         title,
         description,
         category,
         icon,
         duration_minutes,
         difficulty,
         type,
         sensor,
         is_active,
         created_at,
         synced
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        item.id,
        item.title,
        item.description ?? "",
        item.category ?? "General",
        item.icon ?? null,
        item.duration_minutes ?? null,
        item.difficulty ?? null,
        item.type ?? "guided",
        item.sensor ?? null,
        boolToInt(item.is_active),
        item.created_at ?? new Date().toISOString(),
      ],
    );
  }

  // Save guided exercise steps.
  for (const item of catalog.steps) {
    db.execute(
      `INSERT OR REPLACE INTO exercise_steps
       (
         id,
         exercise_id,
         step_order,
         title,
         instruction,
         duration_seconds,
         animation_key,
         voice_prompt,
         created_at,
         synced
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        item.id,
        item.exercise_id,
        item.step_order ?? 0,
        item.title ?? "",
        item.instruction ?? "",
        item.duration_seconds ?? 0,
        item.animation_key ?? null,
        item.voice_prompt ?? null,
        item.created_at ?? new Date().toISOString(),
      ],
    );
  }

  // Save media and audio tracks.
  for (const item of catalog.media) {
    db.execute(
      `INSERT OR REPLACE INTO media_items
       (
         id,
         exercise_id,
         media_type,
         source_url,
         title,
         artist,
         thumbnail_url,
         duration_seconds,
         autoplay,
         loop,
         is_active,
         created_at,
         synced
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        item.id,
        item.exercise_id,
        item.media_type ?? "audio",
        item.source_url ?? "",
        item.title ?? "",
        item.artist ?? null,
        item.thumbnail_url ?? null,
        item.duration_seconds ?? null,
        boolToInt(item.autoplay),
        boolToInt(item.loop),
        boolToInt(item.is_active),
        item.created_at ?? new Date().toISOString(),
      ],
    );
  }

  // Save yoga videos.
  for (const item of catalog.videos) {
    db.execute(
      `INSERT OR REPLACE INTO yoga_videos
       (
         id,
         exercise_id,
         youtube_video_id,
         title,
         channel,
         duration_seconds,
         difficulty,
         focus_area,
         thumbnail_url,
         is_active,
         created_at,
         synced
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        item.id,
        item.exercise_id,
        item.youtube_video_id ?? "",
        item.title ?? "",
        item.channel ?? null,
        item.duration_seconds ?? null,
        item.difficulty ?? null,
        item.focus_area ?? null,
        item.thumbnail_url ?? null,
        boolToInt(item.is_active),
        item.created_at ?? new Date().toISOString(),
      ],
    );
  }

  // Update offline download metadata.
  saveMeta(
    "offline_exercises_downloaded_at",
    new Date().toISOString(),
  );

  saveMeta(
    "offline_exercises_count",
    String(catalog.exercises.length),
  );
}

// ============================================================================
// CATALOGUE BUILDER
// ============================================================================

function buildCatalog(
  exercises: any[],
  steps: any[],
  media: any[],
  videos: any[],
): ExerciseCatalogItem[] {
  return exercises.map((item) => {
    const exerciseSteps = steps.filter(
      (step) => step.exercise_id === item.id,
    );

    const audioTracks = media
      .filter(
        (track) =>
          track.exercise_id === item.id &&
          track.media_type === "audio" &&
          parseBool(track.is_active),
      )
      .map((track) => ({
        ...track,
        autoplay: parseBool(track.autoplay),
        loop: parseBool(track.loop),
        is_active: parseBool(track.is_active),
      }));

    const yogaVideo =
      videos.find(
        (video) =>
          video.exercise_id === item.id &&
          parseBool(video.is_active),
      ) ?? null;

    return {
      ...item,
      is_active: parseBool(item.is_active),
      yoga_video: yogaVideo
        ? {
            ...yogaVideo,
            is_active: parseBool(yogaVideo.is_active),
          }
        : null,
      audio_tracks: audioTracks,
      has_steps: exerciseSteps.length > 0,
    };
  });
}

// ============================================================================
// LOCAL CATALOGUE
// ============================================================================

function readLocalCatalog(): ExerciseCatalogItem[] {
  const exercises = rows<any>(
    `SELECT *
     FROM exercises
     WHERE is_active = 1
     ORDER BY title ASC`,
  );

  const steps = rows<any>(
    `SELECT *
     FROM exercise_steps
     ORDER BY step_order ASC`,
  );

  const media = rows<any>(
    `SELECT *
     FROM media_items
     WHERE is_active = 1`,
  );

  const videos = rows<any>(
    `SELECT *
     FROM yoga_videos
     WHERE is_active = 1`,
  );

  return buildCatalog(
    exercises,
    steps,
    media,
    videos,
  );
}

// ============================================================================
// EXERCISE SERVICE
// ============================================================================

export const exerciseService = {
  /**
   * Fetch the online catalogue first.
   * If the network fails, use the previously downloaded
   * SQLite catalogue.
   */
  async listWithDetails(
    opts?: {
      category?: string;
      type?: string;
    },
  ): Promise<ExerciseCatalogItem[]> {
    let catalogue: ExerciseCatalogItem[];

    try {
      const remote = await fetchRemoteCatalog();

      catalogue = buildCatalog(
        remote.exercises,
        remote.steps,
        remote.media,
        remote.videos,
      );
    } catch (error) {
      console.warn(
        "[exerciseService] Network unavailable; trying offline catalogue.",
        error,
      );

      catalogue = readLocalCatalog();

      if (catalogue.length === 0) {
        throw new Error(
          "No exercises are saved for offline use. Connect to the internet and tap Download for Offline Use.",
        );
      }
    }

    return catalogue.filter((item) => {
      const categoryMatches =
        !opts?.category ||
        opts.category === "All" ||
        item.category === opts.category;

      const typeMatches =
        !opts?.type ||
        item.type === opts.type;

      return categoryMatches && typeMatches;
    });
  },

  /**
   * Download the exercise catalogue and its related records
   * from Supabase into the existing SQLite database.
   */
  async downloadForOffline(): Promise<{
    exerciseCount: number;
    stepCount: number;
    mediaCount: number;
    videoCount: number;
    downloadedAt: string;
  }> {
    const remote = await fetchRemoteCatalog();

    // Cache only after all remote queries have succeeded.
    cacheCatalog(remote);

    const downloadedAt =
      getMeta("offline_exercises_downloaded_at");

    if (!downloadedAt) {
      throw new Error(
        "The exercise catalogue was downloaded, but its offline metadata could not be saved.",
      );
    }

    return {
      exerciseCount: remote.exercises.length,
      stepCount: remote.steps.length,
      mediaCount: remote.media.length,
      videoCount: remote.videos.length,
      downloadedAt,
    };
  },

  /**
   * Check whether exercises are available offline.
   */
  async getOfflineStatus(): Promise<{
    available: boolean;
    exerciseCount: number;
    downloadedAt: string | null;
  }> {
    const localCount =
      rows<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM exercises
         WHERE is_active = 1`,
      )[0]?.count ?? 0;

    return {
      available: localCount > 0,
      exerciseCount: Number(localCount),
      downloadedAt: getMeta(
        "offline_exercises_downloaded_at",
      ),
    };
  },

  /**
   * Return basic exercise information.
   */
  async list(
    opts?: {
      category?: string;
      type?: string;
    },
  ): Promise<Exercise[]> {
    return (await this.listWithDetails(opts)).map(
      ({
        yoga_video,
        audio_tracks,
        has_steps,
        ...exercise
      }) => exercise,
    );
  },

  /**
   * Return available exercise categories.
   */
  async categories(): Promise<string[]> {
    const exercises = await this.listWithDetails();

    return [
      "All",
      ...Array.from(
        new Set(
          exercises.map((item) => item.category),
        ),
      ).sort(),
    ];
  },

  /**
   * Retrieve one exercise's steps, media and videos.
   * If online retrieval fails, use SQLite.
   */
  async getDetail(exerciseId: string): Promise<{
    steps: any[];
    media: any[];
    videos: any[];
  }> {
    if (!exerciseId?.trim()) {
      throw new Error("A valid exercise ID is required.");
    }

    try {
      const [
        stepsResult,
        mediaResult,
        videosResult,
      ] = await Promise.all([
        supabase
          .from("exercise_steps")
          .select("*")
          .eq("exercise_id", exerciseId)
          .order("step_order", { ascending: true }),

        supabase
          .from("media_items")
          .select("*")
          .eq("exercise_id", exerciseId)
          .eq("is_active", true),

        supabase
          .from("yoga_videos")
          .select("*")
          .eq("exercise_id", exerciseId)
          .eq("is_active", true),
      ]);

      if (stepsResult.error) {
        throw stepsResult.error;
      }

      if (mediaResult.error) {
        throw mediaResult.error;
      }

      if (videosResult.error) {
        throw videosResult.error;
      }

      return {
        steps: stepsResult.data ?? [],
        media: (mediaResult.data ?? []).map((item) => ({
          ...item,
          autoplay: parseBool(item.autoplay),
          loop: parseBool(item.loop),
          is_active: parseBool(item.is_active),
        })),
        videos: (videosResult.data ?? []).map((item) => ({
          ...item,
          is_active: parseBool(item.is_active),
        })),
      };
    } catch (error) {
      console.warn(
        "[exerciseService] Could not fetch details online; using SQLite.",
        error,
      );

      return {
        steps: rows<any>(
          `SELECT *
           FROM exercise_steps
           WHERE exercise_id = ?
           ORDER BY step_order ASC`,
          [exerciseId],
        ),

        media: rows<any>(
          `SELECT *
           FROM media_items
           WHERE exercise_id = ?
             AND is_active = 1`,
          [exerciseId],
        ).map((item) => ({
          ...item,
          autoplay: parseBool(item.autoplay),
          loop: parseBool(item.loop),
          is_active: parseBool(item.is_active),
        })),

        videos: rows<any>(
          `SELECT *
           FROM yoga_videos
           WHERE exercise_id = ?
             AND is_active = 1`,
          [exerciseId],
        ).map((item) => ({
          ...item,
          is_active: parseBool(item.is_active),
        })),
      };
    }
  },
};
