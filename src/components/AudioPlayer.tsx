// src/components/AudioPlayer.tsx

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  AppState,
} from "react-native";

import Video from "react-native-video";
import LinearGradient from "react-native-linear-gradient";

import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music2,
  Headphones,
  Leaf,
  Sparkles,
  Check,
  Clock3,
  Repeat2,
  ListMusic,
} from "lucide-react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

/**
 * IMPORTANT:
 * This must match the bucket name in Supabase Storage.
 *
 * For example:
 * Bucket: wellness-audio
 * Object: relaxing-piano.mp3
 *
 * If wellness-audio is a folder in another bucket,
 * change this constant to the actual bucket name.
 */
const AUDIO_STORAGE_BUCKET = "wellness-audio";

/**
 * Signed URLs are valid for one hour.
 * The player generates a URL when a track is selected.
 */
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60;

type Track = {
  id: string;
  title: string;
  artist: string | null;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  loop: boolean | null;
  autoplay: boolean | null;
};

type Props = {
  user: any;
  exercise: {
    id: string;
    title: string;
    category: string;
    type: string;
  };
  tracks: Track[];
  onClose: (completed: boolean) => void;
};

/**
 * Resolves either:
 *
 * 1. A complete HTTPS audio URL.
 * 2. "wellness-audio/relaxing-piano.mp3"
 * 3. "relaxing-piano.mp3" (object path inside the configured bucket).
 *
 * It first tries to generate a signed URL for private buckets.
 * If that fails, it falls back to the public URL format.
 *
 * A returned URL is not proof that the file exists. Video.onError
 * handles missing files, inaccessible objects and unsupported media.
 */
async function resolveAudioUrl(sourceUrl: string): Promise<string> {
  const value = sourceUrl.trim();

  if (!value) {
    throw new Error("This track does not have an audio URL.");
  }

  // Full URLs must be passed through unchanged.
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^(file|content|data):/i.test(value)) {
    throw new Error(
      "This audio source must be an HTTPS URL or a Supabase Storage path."
    );
  }

  const normalizedPath = value
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

  let bucket = AUDIO_STORAGE_BUCKET;
  let filePath = normalizedPath;

  // Accept paths in the form bucket-name/folder/file.mp3.
  // When the first segment is the configured bucket, remove it.
  if (normalizedPath.startsWith(`${bucket}/`)) {
    filePath = normalizedPath.slice(bucket.length + 1);
  } else if (normalizedPath.startsWith("storage/v1/object/")) {
    throw new Error(
      "Use the complete HTTPS Storage URL instead of a partial Storage API path."
    );
  } else if (
    normalizedPath.includes("/") &&
    !normalizedPath.startsWith(`${bucket}/`)
  ) {
    // For other bucket-prefixed paths, treat the first segment
    // as the bucket name.
    const separatorIndex = normalizedPath.indexOf("/");
    bucket = normalizedPath.slice(0, separatorIndex);
    filePath = normalizedPath.slice(separatorIndex + 1);
  }

  if (!bucket || !filePath) {
    throw new Error(
      "Invalid audio Storage path. Check the bucket name and file path."
    );
  }

  // Prefer a signed URL. This supports private buckets when the
  // authenticated user has permission to access the object.
  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, SIGNED_URL_LIFETIME_SECONDS);

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  // Public buckets can still work if signed URL creation is denied.
  const { data: publicData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  if (publicData?.publicUrl) {
    return publicData.publicUrl;
  }

  throw new Error(
    signedError?.message ||
      "Could not generate an audio URL. Check your Storage bucket configuration."
  );
}

export default function AudioPlayer({
  user,
  exercise,
  tracks,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  const appStateRef = useRef(AppState.currentState);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);

  const sessionIdRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string | null> | null>(null);

  const elapsedRef = useRef(0);
  const lastPositionRef = useRef(0);
  const playbackErrorRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);

  const current = tracks[index];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const formatTime = useCallback((value: number) => {
    const safeValue = Math.max(0, Math.floor(value));
    const mins = Math.floor(safeValue / 60);
    const secs = safeValue % 60;

    return `${mins}:${String(secs).padStart(2, "0")}`;
  }, []);

  const pauseAudio = useCallback(() => {
    if (mountedRef.current) {
      setPlaying(false);
    }
  }, []);

  // Create one listening session for this player instance.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    sessionPromiseRef.current = (async () => {
      if (!user?.id) {
        return null;
      }

      try {
        const { data, error } = await supabase
          .from("wellness_sessions")
          .insert({
            user_id: user.id,
            exercise_id: exercise.id,
            session_type: "music",
            category: exercise.category,
            completed: false,
            duration_seconds: 0,
            started_at: new Date().toISOString(),
            metadata: {
              source: "audio_player",
              exercise_title: exercise.title,
              track_count: tracks.length,
            },
          })
          .select("id")
          .single();

        if (error) {
          console.warn(
            "[AudioPlayer] Session creation failed:",
            error.message
          );

          return null;
        }

        if (cancelled) {
          return data.id as string;
        }

        sessionIdRef.current = data.id;
        setSessionReady(true);

        return data.id as string;
      } catch (error) {
        console.warn("[AudioPlayer] Session creation error:", error);
        return null;
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [
    user?.id,
    exercise.id,
    exercise.category,
    exercise.title,
    tracks.length,
  ]);

  // Resolve each track URL before asking the native player to load it.
  useEffect(() => {
    let cancelled = false;

    async function prepareTrack() {
      if (!current) {
        setLoading(false);
        setPlaying(false);
        setPlayableUrl(null);
        return;
      }

      playbackErrorRef.current = null;
      lastPositionRef.current = 0;

      setPosition(0);
      setDuration(current.duration_seconds ?? 0);
      setPlayableUrl(null);
      setPlaying(false);
      setLoading(true);

      try {
        const url = await resolveAudioUrl(current.source_url);

        if (cancelled || !mountedRef.current) {
          return;
        }

        setPlayableUrl(url);
        setPlaying(current.autoplay ?? true);
      } catch (error) {
        if (cancelled || !mountedRef.current) {
          return;
        }

        setLoading(false);
        setPlaying(false);

        const message =
          error instanceof Error
            ? error.message
            : "Unable to resolve the audio URL.";

        console.warn(
          `[AudioPlayer] URL resolution failed for "${current.title}":`,
          message
        );

        Alert.alert(
          "Unable to prepare audio",
          `${current.title}\n\n${message}`
        );
      }
    }

    void prepareTrack();

    return () => {
      cancelled = true;
    };
  }, [current?.id, current?.source_url]);

  // Pause audio when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState) => {
        const wasActive = appStateRef.current === "active";
        const goingInactive =
          nextState === "inactive" || nextState === "background";

        if (wasActive && goingInactive) {
          pauseAudio();
        }

        appStateRef.current = nextState;
      }
    );

    return () => subscription.remove();
  }, [pauseAudio]);

  const finishSession = useCallback(
    async (completed: boolean) => {
      if (savingRef.current || finishedRef.current) {
        return;
      }

      if (!user?.id) {
        Alert.alert(
          "Sign in required",
          "Please sign in before saving your listening session."
        );
        return;
      }

      savingRef.current = true;
      setSaving(true);
      pauseAudio();

      try {
        const sessionId =
          sessionIdRef.current ??
          (sessionPromiseRef.current
            ? await sessionPromiseRef.current
            : null);

        if (!sessionId) {
          throw new Error(
            "Your listening session could not be created. Check your connection, database permissions and try again."
          );
        }

        const totalElapsed = Math.max(
          0,
          Math.floor(elapsedRef.current)
        );

        const { error: sessionError } = await supabase
          .from("wellness_sessions")
          .update({
            completed,
            duration_seconds: totalElapsed,
            completed_at: completed
              ? new Date().toISOString()
              : null,
            metadata: {
              source: "audio_player",
              exercise_title: exercise.title,
              track_count: tracks.length,
              last_track_title: current?.title ?? null,
            },
          })
          .eq("id", sessionId)
          .eq("user_id", user.id);

        if (sessionError) {
          throw sessionError;
        }

        if (completed) {
          const { error: activityError } = await supabase
            .from("daily_activities")
            .insert({
              user_id: user.id,
              activity_type: exercise.category || "Music",
              duration_minutes: Math.max(
                1,
                Math.round(totalElapsed / 60)
              ),
              completed: true,
            });

          if (activityError) {
            console.warn(
              "[AudioPlayer] Activity logging failed:",
              activityError.message
            );
          }
        }

        finishedRef.current = true;

        if (mountedRef.current) {
          onCloseRef.current(completed);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Something went wrong while saving your session.";

        Alert.alert("Unable to save session", message);
      } finally {
        savingRef.current = false;

        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [
      user?.id,
      exercise,
      tracks.length,
      current?.title,
      pauseAudio,
    ]
  );

  const togglePlay = useCallback(() => {
    if (
      saving ||
      loading ||
      !playableUrl ||
      finishedRef.current
    ) {
      return;
    }

    setPlaying((previous) => !previous);
  }, [saving, loading, playableUrl]);

  const changeTrack = useCallback(
    (nextIndex: number) => {
      if (
        saving ||
        finishedRef.current ||
        nextIndex < 0 ||
        nextIndex >= tracks.length
      ) {
        return;
      }

      setIndex(nextIndex);
    },
    [saving, tracks.length]
  );

  const handleTrackEnd = useCallback(() => {
    if (
      !mountedRef.current ||
      savingRef.current ||
      finishedRef.current
    ) {
      return;
    }

    if (current?.loop) {
      return;
    }

    if (index < tracks.length - 1) {
      setIndex((previous) => previous + 1);
    } else {
      void finishSession(true);
    }
  }, [current?.loop, index, tracks.length, finishSession]);

  const handlePlaybackError = useCallback(
    (error: any) => {
      if (!mountedRef.current || finishedRef.current) {
        return;
      }

      setLoading(false);
      setPlaying(false);

      const errorKey = current?.id ?? "unknown";

      if (playbackErrorRef.current === errorKey) {
        return;
      }

      playbackErrorRef.current = errorKey;

      // Avoid printing signed URL tokens to logs.
      const nativeError = error?.error ?? error;
      const errorCode =
        nativeError?.errorCode ??
        nativeError?.code ??
        "unknown";

      const errorMessage =
        nativeError?.errorString ??
        nativeError?.localizedDescription ??
        nativeError?.message ??
        "No native error message was provided.";

      console.warn("[AudioPlayer] Native playback error:", {
        trackId: current?.id,
        title: current?.title,
        errorCode,
        errorMessage,
      });

      Alert.alert(
        "Unable to play audio",
        `Couldn't play "${current?.title ?? "this track"}".\n\nCheck that the file exists in Supabase Storage, the bucket and file permissions are correct, and the URL points to a supported audio file.\n\nError: ${String(errorCode)}`
      );
    },
    [current?.id, current?.title]
  );

  const handleProgress = useCallback(
    (data: any) => {
      if (!mountedRef.current) {
        return;
      }

      const nextPosition = Math.max(
        0,
        Number(data?.currentTime) || 0
      );

      const previousPosition = lastPositionRef.current;

      if (playing && appStateRef.current === "active") {
        // Count forward playback, including a track looping to zero.
        const difference =
          nextPosition >= previousPosition
            ? nextPosition - previousPosition
            : nextPosition;

        if (difference > 0 && difference < 10) {
          elapsedRef.current += difference;
          setElapsed(Math.floor(elapsedRef.current));
        }
      }

      lastPositionRef.current = nextPosition;
      setPosition(nextPosition);
    },
    [playing]
  );

  const handleLoad = useCallback(
    (data: any) => {
      if (!mountedRef.current) {
        return;
      }

      const loadedDuration = Number(data?.duration) || 0;

      setDuration(
        loadedDuration > 0
          ? loadedDuration
          : current?.duration_seconds ?? 0
      );

      setLoading(false);
    },
    [current?.duration_seconds]
  );

  const handleExit = useCallback(() => {
    Alert.alert(
      "End listening session?",
      "Your listening time will be saved as an incomplete session.",
      [
        {
          text: "Keep listening",
          style: "cancel",
        },
        {
          text: "Exit session",
          style: "destructive",
          onPress: () => {
            void finishSession(false);
          },
        },
      ]
    );
  }, [finishSession]);

  if (!current) {
    return (
      <View
        style={[
          styles.root,
          styles.emptyRoot,
          { paddingTop: insets.top + 24 },
        ]}
      >
        <View style={styles.emptyIcon}>
          <Music2 size={32} color="#247A4A" />
        </View>

        <Text style={styles.emptyTitle}>No tracks available</Text>

        <Text style={styles.emptyDescription}>
          There are no audio tracks available for this session yet.
        </Text>

        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => onClose(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress =
    duration > 0
      ? Math.min(100, Math.max(0, (position / duration) * 100))
      : 0;

  return (
    <View
      style={[
        styles.root,
        { paddingTop: Math.max(insets.top, 8) },
      ]}
    >
      {playableUrl ? (
        <Video
          key={`${current.id}:${playableUrl}`}
          source={{ uri: playableUrl }}
          paused={!playing || saving}
          repeat={!!current.loop}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          resizeMode="contain"
          onLoad={handleLoad}
          onProgress={handleProgress}
          onEnd={handleTrackEnd}
          onError={handlePlaybackError}
          onLoadStart={() => setLoading(true)}
          onBuffer={({ isBuffering }) => setLoading(isBuffering)}
          progressUpdateInterval={500}
          style={styles.hiddenPlayer}
        />
      ) : null}

      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F8F5"
      />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleExit}
          style={styles.backButton}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Exit audio player"
        >
          <ArrowLeft size={21} color="#294436" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {exercise.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            A MOMENT FOR YOU
          </Text>
        </View>

        <View style={styles.trackCounter}>
          <ListMusic size={15} color="#247A4A" />
          <Text style={styles.counterText}>
            {index + 1}/{tracks.length}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 12) + 28 },
        ]}
      >
        {/* INTRO */}
        <View style={styles.introRow}>
          <View style={styles.introIcon}>
            <Sparkles size={18} color="#247A4A" />
          </View>

          <View style={styles.introText}>
            <Text style={styles.introTitle}>Find your calm</Text>
            <Text style={styles.introSubtitle}>
              Unwind, focus, and reconnect with yourself.
            </Text>
          </View>

          <Leaf size={24} color="#8AB99A" />
        </View>

        {/* ALBUM ART */}
        <LinearGradient
          colors={["#D9F0E1", "#B9DFC8", "#EAF6EE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.artworkCard}
        >
          <View style={styles.artDecorationOne} />
          <View style={styles.artDecorationTwo} />

          {current.thumbnail_url ? (
            <Image
              source={{ uri: current.thumbnail_url }}
              style={styles.artworkImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.artworkFallback}>
              <LinearGradient
                colors={["#2D8655", "#195B3A"]}
                style={styles.artworkDisc}
              >
                <View style={styles.discRing}>
                  <View style={styles.discInner}>
                    <Headphones
                      size={42}
                      color="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.artworkSparkle}>
                <Sparkles size={22} color="#247A4A" />
              </View>
            </View>
          )}

          <View style={styles.artworkLabel}>
            <Music2 size={12} color="#FFFFFF" />
            <Text style={styles.artworkLabelText}>
              WELLNESS AUDIO
            </Text>
          </View>
        </LinearGradient>

        {/* TRACK DETAILS */}
        <View style={styles.trackDetails}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {current.title}
          </Text>

          <Text style={styles.trackArtist} numberOfLines={1}>
            {current.artist || "Wellness AI • Mindful listening"}
          </Text>

          <View style={styles.trackTags}>
            <View style={styles.tag}>
              <Leaf size={12} color="#4D8962" />
              <Text style={styles.tagText}>
                {exercise.category || "Wellness"}
              </Text>
            </View>

            {current.loop && (
              <View style={styles.tag}>
                <Repeat2 size={12} color="#4D8962" />
                <Text style={styles.tagText}>Loop enabled</Text>
              </View>
            )}
          </View>
        </View>

        {/* SEEK BAR */}
        <View style={styles.seekSection}>
          <View style={styles.seekTrack}>
            <View
              style={[
                styles.seekFill,
                { width: `${progress}%` },
              ]}
            />
            <View
              style={[
                styles.seekThumb,
                { left: `${progress}%` },
              ]}
            />
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {formatTime(position)}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(duration || current.duration_seconds || 0)}
            </Text>
          </View>
        </View>

        {/* PLAYBACK CONTROLS */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => changeTrack(index - 1)}
            disabled={index === 0 || saving}
            style={[
              styles.sideControl,
              (index === 0 || saving) && styles.controlDisabled,
            ]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Previous track"
          >
            <SkipBack size={23} color="#315C40" fill="#315C40" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlay}
            disabled={loading || saving || !playableUrl}
            style={[
              styles.playButton,
              (loading || saving || !playableUrl) &&
                styles.controlDisabled,
            ]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause audio" : "Play audio"}
          >
            <LinearGradient
              colors={["#2C8552", "#17613B"]}
              style={styles.playButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : playing ? (
                <Pause size={29} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={29} color="#FFFFFF" fill="#FFFFFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeTrack(index + 1)}
            disabled={index >= tracks.length - 1 || saving}
            style={[
              styles.sideControl,
              (index >= tracks.length - 1 || saving) &&
                styles.controlDisabled,
            ]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Next track"
          >
            <SkipForward size={23} color="#315C40" fill="#315C40" />
          </TouchableOpacity>
        </View>

        <Text style={styles.playbackHint}>
          {loading
            ? "Preparing your audio..."
            : playing
              ? "Playing • Take a deep breath"
              : "Paused • Continue whenever you're ready"}
        </Text>

        {/* SESSION SUMMARY */}
        <View style={styles.sessionCard}>
          <View style={styles.sessionIcon}>
            <Clock3 size={19} color="#247A4A" />
          </View>

          <View style={styles.sessionText}>
            <Text style={styles.sessionTitle}>
              Your listening session
            </Text>
            <Text style={styles.sessionSubtitle}>
              Time spent listening to your audio
            </Text>
          </View>

          <Text style={styles.sessionTime}>
            {formatTime(elapsed)}
          </Text>
        </View>

        {/* FINISH */}
        <TouchableOpacity
          style={[
            styles.finishButton,
            (saving || !sessionReady) && styles.controlDisabled,
          ]}
          onPress={() => void finishSession(true)}
          disabled={saving || !sessionReady}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Finish and save listening session"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Check size={19} color="#FFFFFF" strokeWidth={2.5} />
          )}

          <Text style={styles.finishButtonText}>
            {saving
              ? "Saving your session..."
              : !sessionReady
                ? "Preparing session..."
                : "Finish & Save Session"}
          </Text>
        </TouchableOpacity>

        <View style={styles.privacyNote}>
          <Leaf size={15} color="#7D9B87" />
          <Text style={styles.privacyText}>
            Every moment you give yourself counts.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F8F5",
  },
  hiddenPlayer: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  emptyRoot: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: "#E5F3E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#293D31",
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: "#829087",
    marginTop: 9,
  },
  emptyButton: {
    marginTop: 23,
    paddingHorizontal: 28,
    paddingVertical: 13,
    backgroundColor: "#247A4A",
    borderRadius: 15,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 19,
    paddingTop: 8,
    paddingBottom: 17,
  },
  backButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3ECE5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#293D31",
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#7D9885",
    marginTop: 4,
  },
  trackCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E6F3E9",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 13,
  },
  counterText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#247A4A",
  },
  content: {
    paddingHorizontal: 20,
  },
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  introIcon: {
    width: 41,
    height: 41,
    borderRadius: 14,
    backgroundColor: "#E3F2E7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  introText: {
    flex: 1,
  },
  introTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2B4936",
  },
  introSubtitle: {
    fontSize: 11,
    color: "#87958B",
    marginTop: 4,
  },
  artworkCard: {
    width: "100%",
    aspectRatio: 1.12,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 23,
    borderWidth: 1,
    borderColor: "#D1E7D8",
  },
  artDecorationOne: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(255,255,255,0.22)",
    top: -100,
    right: -70,
  },
  artDecorationTwo: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.18)",
    bottom: -80,
    left: -65,
  },
  artworkImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  artworkFallback: {
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkDisc: {
    width: 184,
    height: 184,
    borderRadius: 92,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#164B30",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  discRing: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  discInner: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  artworkSparkle: {
    position: "absolute",
    right: 12,
    top: 23,
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  artworkLabel: {
    position: "absolute",
    left: 15,
    bottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: "rgba(25,75,47,0.85)",
  },
  artworkLabelText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#FFFFFF",
  },
  trackDetails: {
    alignItems: "center",
    marginBottom: 25,
  },
  trackTitle: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#263D2F",
    textAlign: "center",
  },
  trackArtist: {
    fontSize: 13,
    color: "#829087",
    marginTop: 7,
  },
  trackTags: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 13,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#E7F3EA",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#477857",
  },
  seekSection: {
    marginBottom: 20,
  },
  seekTrack: {
    height: 6,
    borderRadius: 5,
    backgroundColor: "#DFEAE2",
    overflow: "visible",
    position: "relative",
  },
  seekFill: {
    height: 6,
    borderRadius: 5,
    backgroundColor: "#247A4A",
  },
  seekThumb: {
    position: "absolute",
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#247A4A",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    top: -3.5,
    marginLeft: -6.5,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#849187",
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 31,
    marginTop: 7,
  },
  sideControl: {
    width: 53,
    height: 53,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4ECE6",
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 29,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#247A4A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  playButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
  },
  controlDisabled: {
    opacity: 0.45,
  },
  playbackHint: {
    textAlign: "center",
    fontSize: 11,
    color: "#829087",
    marginTop: 15,
    marginBottom: 25,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECE7",
    borderRadius: 20,
    padding: 15,
    marginBottom: 17,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E7F4EA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sessionText: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#304438",
  },
  sessionSubtitle: {
    fontSize: 10,
    color: "#87948B",
    marginTop: 5,
  },
  sessionTime: {
    fontSize: 15,
    fontWeight: "800",
    color: "#247A4A",
    fontVariant: ["tabular-nums"],
  },
  finishButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#247A4A",
    borderRadius: 18,
    paddingHorizontal: 16,
    elevation: 3,
    shadowColor: "#247A4A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
  },
  finishButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 19,
  },
  privacyText: {
    fontSize: 10,
    color: "#84968A",
  },
});
