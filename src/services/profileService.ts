//src/services/profileService.ts
import { supabase } from "../lib/supabase";

export async function getCurrentProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("No authenticated user");
  }

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProfile(
  updates: {
    full_name?: string;
    avatar_url?: string;
    wellness_goal?: string;
    onboarding_completed?: boolean;
  }
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("No authenticated user");
  }

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}