//src/services/moodService.ts
import { supabase } from "../lib/supabase";

export const moodService = {
  async logMood(payload: {
    user_id: string;
    mood: number;
    energy?: number;
    stress?: number;
    note?: string;
  }) {
    const { data, error } = await supabase
      .from("mood_logs")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};