//src/services/profileService.ts


import NetInfo from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";

import { supabase } from "../lib/supabase";
import {
  getDatabase,
  initializeDatabase,
} from "../database/database";

export type UserProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  avatar_local_data: string | null;
  avatar_needs_upload: number;
  wellness_goal: string | null;
  onboarding_completed: number;
  created_at: string;
  updated_at: string;
  synced: number;
};

type ProfileUpdates = {
  full_name?: string;
  wellness_goal?: string;
  onboarding_completed?: boolean;
};

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

async function getAuthenticatedUser() {
  // getSession reads the persisted local session and does not
  // require a fresh network request.
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;

  if (!session?.user) {
    throw new Error("You must be signed in to access your profile.");
  }

  return session.user;
}

function getLocalProfile(userId: string): UserProfile | null {
  const db = getDatabase();

  const result = db.execute<UserProfile>(
    `SELECT *
     FROM profiles
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );

  return result.rows._array[0] ?? null;
}

function saveLocalProfile(profile: UserProfile) {
  const db = getDatabase();

  db.execute(
    `INSERT OR REPLACE INTO profiles (
      id,
      email,
      full_name,
      avatar_url,
      avatar_local_data,
      avatar_needs_upload,
      wellness_goal,
      onboarding_completed,
      created_at,
      updated_at,
      synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.email,
      profile.full_name,
      profile.avatar_url,
      profile.avatar_local_data,
      profile.avatar_needs_upload,
      profile.wellness_goal,
      profile.onboarding_completed,
      profile.created_at,
      profile.updated_at,
      profile.synced,
    ],
  );
}

function queueProfileSync(profile: UserProfile) {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Keep one pending profile update per user.
  db.execute(
    `DELETE FROM sync_queue
     WHERE table_name = ?
       AND user_id = ?
       AND status = 'pending'`,
    ["profiles", profile.id],
  );

  const payload = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    wellness_goal: profile.wellness_goal,
    onboarding_completed: profile.onboarding_completed,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };

  db.execute(
    `INSERT INTO sync_queue (
      id,
      table_name,
      record_id,
      user_id,
      operation,
      payload,
      status,
      retry_count,
      last_error,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId("sync"),
      "profiles",
      profile.id,
      profile.id,
      "UPDATE",
      JSON.stringify(payload),
      "pending",
      0,
      null,
      now,
      now,
    ],
  );
}

function createInitialProfile(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}): UserProfile {
  const now = new Date().toISOString();

  return {
    id: user.id,
    email: user.email ?? null,
    full_name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      null,
    avatar_url: null,
    avatar_local_data: null,
    avatar_needs_upload: 0,
    wellness_goal: null,
    onboarding_completed: 0,
    created_at: now,
    updated_at: now,
    synced: 0,
  };
}

/**
 * Get the user's profile.
 * SQLite is checked first so the profile remains available offline.
 */
export async function getCurrentProfile(): Promise<UserProfile> {
  await initializeDatabase();

  const user = await getAuthenticatedUser();

  const localProfile = getLocalProfile(user.id);

  if (localProfile) {
    const network = await NetInfo.fetch();

    if (!network.isConnected) {
      return localProfile;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const refreshed: UserProfile = {
          ...localProfile,
          ...data,
          avatar_local_data: localProfile.avatar_local_data,
          avatar_needs_upload: localProfile.avatar_needs_upload,
          synced: 1,
        };

        saveLocalProfile(refreshed);
        return refreshed;
      }

      return localProfile;
    } catch (error) {
      console.warn(
        "[ProfileService] Could not refresh profile; using local copy:",
        error,
      );

      return localProfile;
    }
  }

  const initialProfile = createInitialProfile(user);

  saveLocalProfile(initialProfile);

  const network = await NetInfo.fetch();

  if (!network.isConnected) {
    return initialProfile;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: initialProfile.id,
          email: initialProfile.email,
          full_name: initialProfile.full_name,
          created_at: initialProfile.created_at,
          updated_at: initialProfile.updated_at,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (error) throw error;

    const profile: UserProfile = {
      ...initialProfile,
      ...data,
      avatar_local_data: null,
      avatar_needs_upload: 0,
      synced: 1,
    };

    saveLocalProfile(profile);

    return profile;
  } catch (error) {
    console.warn(
      "[ProfileService] Using locally created profile:",
      error,
    );

    return initialProfile;
  }
}

/**
 * Save text profile changes locally and queue them for sync.
 */
export async function updateProfile(
  updates: ProfileUpdates,
): Promise<UserProfile> {
  await initializeDatabase();

  const user = await getAuthenticatedUser();

  const current =
    getLocalProfile(user.id) ?? createInitialProfile(user);

  const updated: UserProfile = {
    ...current,
    ...(updates.full_name !== undefined
      ? { full_name: updates.full_name.trim() || null }
      : {}),
    ...(updates.wellness_goal !== undefined
      ? { wellness_goal: updates.wellness_goal.trim() || null }
      : {}),
    ...(updates.onboarding_completed !== undefined
      ? { onboarding_completed: updates.onboarding_completed ? 1 : 0 }
      : {}),
    updated_at: new Date().toISOString(),
    synced: 0,
  };

  saveLocalProfile(updated);
  queueProfileSync(updated);

  return updated;
}

/**
 * Save a selected profile image locally.
 * The image is uploaded by the sync manager when online.
 */
export async function updateProfilePicture(
  base64Image: string,
): Promise<UserProfile> {
  await initializeDatabase();

  if (!base64Image?.trim()) {
    throw new Error("The selected image is empty.");
  }

  const user = await getAuthenticatedUser();

  const current =
    getLocalProfile(user.id) ?? createInitialProfile(user);

  const updated: UserProfile = {
    ...current,
    avatar_local_data: base64Image,
    avatar_needs_upload: 1,
    updated_at: new Date().toISOString(),
    synced: 0,
  };

  saveLocalProfile(updated);
  queueProfileSync(updated);

  return updated;
}

/**
 * Remove the local and remote profile-picture reference.
 * The sync manager will remove the old remote object.
 */
export async function removeProfilePicture(): Promise<UserProfile> {
  await initializeDatabase();

  const user = await getAuthenticatedUser();

  const current =
    getLocalProfile(user.id) ?? createInitialProfile(user);

  const updated: UserProfile = {
    ...current,
    avatar_url: null,
    avatar_local_data: null,
    avatar_needs_upload: 0,
    updated_at: new Date().toISOString(),
    synced: 0,
  };

  saveLocalProfile(updated);
  queueProfileSync(updated);

  return updated;
}

/**
 * Upload the locally cached avatar.
 * Called by the sync manager when a network connection is available.
 */
export async function uploadPendingProfilePicture(
  userId: string,
): Promise<string | null> {
  const profile = getLocalProfile(userId);

  if (!profile?.avatar_needs_upload) {
    return profile?.avatar_url ?? null;
  }

  if (!profile.avatar_local_data) {
    return null;
  }

  const filePath = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(
      filePath,
      decode(profile.avatar_local_data),
      {
        contentType: "image/jpeg",
        upsert: true,
      },
    );

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("profile-avatars")
    .getPublicUrl(filePath);

  const updated: UserProfile = {
    ...profile,
    avatar_url: data.publicUrl,
    avatar_needs_upload: 0,
    updated_at: new Date().toISOString(),
    synced: 0,
  };

  saveLocalProfile(updated);

  return data.publicUrl;
}
