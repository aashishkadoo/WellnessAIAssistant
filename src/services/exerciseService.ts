// src/services/exerciseService.ts
import { supabase } from "../lib/supabase";

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

export const exerciseService = {
  /**
   * Fetch all active exercises.
   * Optional filter by category or type.
   */
  async list(opts?: { category?: string; type?: string }) {
    let q = supabase
      .from("exercises")
      .select("*")
      .eq("is_active", true)
      .order("title", { ascending: true });

    if (opts?.category && opts.category !== "All") {
      q = q.eq("category", opts.category);
    }
    if (opts?.type) {
      q = q.eq("type", opts.type);
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Exercise[];
  },

  /** Distinct categories present in exercises — for filter chips */
  async categories(): Promise<string[]> {
    const { data, error } = await supabase
      .from("exercises")
      .select("category")
      .eq("is_active", true);
    if (error) throw error;
    const set = new Set((data ?? []).map((r) => r.category));
    return ["All", ...Array.from(set).sort()];
  },

  /** Full detail for the detail screen */
  async getDetail(exerciseId: string) {
    const [steps, media, videos] = await Promise.all([
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
    return {
      steps: steps.data ?? [],
      media: media.data ?? [],
      videos: videos.data ?? [],
    };
  },
};