//src/components/aiwellness.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Easing, Pressable, StatusBar,
  StyleSheet, Text, View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Video from "react-native-video";
import Tts from "react-native-tts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft, Brain, Check, Heart, Moon, Pause, Play, Sparkles,
  Volume2, VolumeX, Wind, X,
} from "lucide-react-native";
import { getDatabase, initializeDatabase } from "../database/database";

type Mood = "stressed" | "tired" | "okay" | "happy";
type Goal = "relax" | "focus" | "energy" | "sleep";
type Phase = "inhale" | "hold" | "exhale" | "rest";
type AIWellnessPlan = { title: string; introduction: string };
type Props = {
  user: any;
  onClose: (completed?: boolean) => void;
  ambientAudioUrl?: string;
  onGeneratePlan?: (input: {
    mood: Mood; goal: Goal; durationMinutes: number;
  }) => Promise<AIWellnessPlan>;
};
type SaveStatus = "idle" | "saving" | "saved" | "error";

const COLORS = {
  background: "#071B18", surface: "#102A25", green: "#70E6A0",
  mint: "#B9F5D0", text: "#F2FFF6", muted: "#A2C4B1", gold: "#F4D58A",
};
const PHASES: { phase: Phase; seconds: number; instruction: string }[] = [
  { phase: "inhale", seconds: 4, instruction: "Breathe in slowly" },
  { phase: "hold", seconds: 2, instruction: "Hold gently" },
  { phase: "exhale", seconds: 6, instruction: "Release your breath" },
  { phase: "rest", seconds: 2, instruction: "Rest and relax" },
];
const CYCLE_SECONDS = PHASES.reduce((sum, item) => sum + item.seconds, 0);
const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: "stressed", label: "Stressed", emoji: "😣" },
  { value: "tired", label: "Tired", emoji: "😴" },
  { value: "okay", label: "Okay", emoji: "😐" },
  { value: "happy", label: "Good", emoji: "😊" },
];
const GOALS: { value: Goal; label: string; icon: any }[] = [
  { value: "relax", label: "Relax", icon: Wind },
  { value: "focus", label: "Focus", icon: Brain },
  { value: "energy", label: "Energy", icon: Sparkles },
  { value: "sleep", label: "Sleep", icon: Moon },
];
const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
function getPhaseAt(elapsed: number): Phase {
  let position = elapsed % CYCLE_SECONDS;
  for (const item of PHASES) {
    if (position < item.seconds) return item.phase;
    position -= item.seconds;
  }
  return "inhale";
}
const getPhaseInstruction = (phase: Phase) =>
  PHASES.find((item) => item.phase === phase)?.instruction ?? "";

export default function AIWellness({ user, onClose, ambientAudioUrl, onGeneratePlan }: Props) {
  const insets = useSafeAreaInsets();
  const [mood, setMood] = useState<Mood>("okay");
  const [goal, setGoal] = useState<Goal>("relax");
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<AIWellnessPlan | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const orbScale = useRef(new Animated.Value(0.82)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const particleRotation = useRef(new Animated.Value(0)).current;
  const elapsedRef = useRef(0);
  const runStartedAtRef = useRef<number | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const finishedRef = useRef(false);
  const totalSeconds = durationMinutes * 60;
  const phase = getPhaseAt(elapsed);
  const remaining = Math.max(0, totalSeconds - elapsed);
  const progress = Math.min(1, elapsed / totalSeconds);
  const phaseColor = useMemo(() => {
    switch (phase) {
      case "inhale": return "#75E9AA";
      case "hold": return "#A4DDF4";
      case "exhale": return "#B5A5F5";
      default: return "#F2D89B";
    }
  }, [phase]);

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(particleRotation, {
      toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [particleRotation]);

  useEffect(() => {
    const targetScale = phase === "inhale" || phase === "hold" ? 1.12 : phase === "exhale" ? 0.78 : 0.82;
    Animated.parallel([
      Animated.timing(orbScale, {
        toValue: targetScale,
        duration: phase === "inhale" ? 4000 : phase === "exhale" ? 6000 : 2000,
        easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: phase === "inhale" ? 0.9 : 0.35,
        duration: 1500, useNativeDriver: true,
      }),
    ]).start();
  }, [phase, orbScale, glowOpacity]);

  useEffect(() => {
    if (!started || !running || !voiceEnabled) return;
    Tts.stop();
    Tts.speak(getPhaseInstruction(phase));
  }, [phase, started, running, voiceEnabled]);

  // Use wall-clock deltas so delayed JS timer callbacks do not shorten sessions.
  useEffect(() => {
    if (!running || completed) return;
    if (runStartedAtRef.current === null) runStartedAtRef.current = Date.now();
    const timer = setInterval(() => {
      const runStart = runStartedAtRef.current;
      if (runStart === null) return;
      const next = Math.min(totalSeconds, elapsedRef.current + Math.floor((Date.now() - runStart) / 1000));
      setElapsed(next);
      if (next >= totalSeconds) {
        elapsedRef.current = totalSeconds;
        runStartedAtRef.current = null;
        setRunning(false);
        setCompleted(true);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [running, completed, totalSeconds]);

  useEffect(() => {
    if (!started || elapsed === 0) return;
    const completedCycles = Math.floor(elapsed / CYCLE_SECONDS);
    setCycles(completedCycles);
    setScore(completedCycles * 10);
  }, [elapsed, started]);

  useEffect(() => () => { Tts.stop(); }, []);

  const saveCompletedSession = useCallback(async () => {
    if (savingRef.current || finishedRef.current) return;
    if (!user?.id) {
      setSaveStatus("error");
      setSaveError("You must be signed in to save this session.");
      return;
    }
    savingRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await initializeDatabase();
      const db = getDatabase();
      const completedAt = new Date().toISOString();
      const startedAt = startedAtRef.current ?? completedAt;
      const sessionId = sessionIdRef.current ?? createId("aiwellness");
      sessionIdRef.current = sessionId;
      const record = {
        id: sessionId,
        user_id: user.id,
        exercise_id: "ai-wellness-session",
        session_type: "ai_wellness",
        category: "AI",
        duration_seconds: durationMinutes * 60,
        completed: 1,
        mood_before: null,
        mood_after: null,
        notes: null,
        metadata: JSON.stringify({
          source: "ai_wellness", mood, goal, duration_minutes: durationMinutes,
          score, completed_cycles: cycles, breathing_cycle_seconds: CYCLE_SECONDS,
          plan_title: plan?.title ?? null,
          plan_introduction: plan?.introduction ?? null,
        }),
        started_at: startedAt,
        completed_at: completedAt,
        created_at: completedAt,
        synced: 0,
      };
      await db.execute(
        `INSERT INTO wellness_sessions (
          id, user_id, exercise_id, session_type, category, duration_seconds,
          completed, mood_before, mood_after, notes, metadata, started_at,
          completed_at, created_at, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [record.id, record.user_id, record.exercise_id, record.session_type,
          record.category, record.duration_seconds, record.completed,
          record.mood_before, record.mood_after, record.notes, record.metadata,
          record.started_at, record.completed_at, record.created_at, record.synced],
      );
      try {
        await db.execute(
          `INSERT INTO sync_queue (
            id, table_name, record_id, user_id, operation, payload, status,
            retry_count, last_error, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [createId("sync"), "wellness_sessions", sessionId, user.id,
            "INSERT", JSON.stringify(record), "pending", 0, null,
            completedAt, completedAt],
        );
        finishedRef.current = true;
        setSaveStatus("saved");
      } catch (queueError) {
        // The session is safe locally; only its pending sync entry failed.
        console.error("[AIWellness] Sync queue insertion failed:", queueError);
        finishedRef.current = true;
        setSaveStatus("saved");
        setSaveError("Session saved on this device, but its sync request could not be queued.");
      }
    } catch (error) {
      console.error("[AIWellness] Session save failed:", error);
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to save your completed session.");
    } finally {
      savingRef.current = false;
    }
  }, [user, durationMinutes, mood, goal, score, cycles, plan]);

  useEffect(() => {
    if (completed && !finishedRef.current && !savingRef.current) {
      void saveCompletedSession();
    }
  }, [completed, saveCompletedSession]);

  const beginSession = useCallback(() => {
    elapsedRef.current = 0;
    runStartedAtRef.current = Date.now();
    startedAtRef.current = new Date().toISOString();
    sessionIdRef.current = createId("aiwellness");
    savingRef.current = false;
    finishedRef.current = false;
    setElapsed(0);
    setScore(0);
    setCycles(0);
    setSaveStatus("idle");
    setSaveError(null);
    setStarted(true);
    setRunning(true);
    setCompleted(false);
  }, []);

  const startSession = useCallback(async () => {
    setGenerating(true);
    try {
      if (onGeneratePlan) {
        const generatedPlan = await onGeneratePlan({ mood, goal, durationMinutes });
        setPlan(generatedPlan);
      } else {
        setPlan({
          title: goal === "sleep" ? "Prepare for peaceful rest" : goal === "focus" ? "Find your focus" : goal === "energy" ? "Restore your energy" : "Return to calm",
          introduction: "Follow the breathing light. Let each breath become slower and more comfortable.",
        });
      }
    } catch (error) {
      console.error("[AIWellness] Plan generation failed:", error);
      setPlan({ title: "Your calming session", introduction: "Follow the breathing light at your own comfortable pace." });
    } finally {
      setGenerating(false);
      beginSession();
    }
  }, [onGeneratePlan, mood, goal, durationMinutes, beginSession]);

  const toggleSession = useCallback(() => {
    if (completed || saveStatus === "saving") return;
    if (running) {
      const runStart = runStartedAtRef.current;
      if (runStart !== null) {
        elapsedRef.current = Math.min(totalSeconds, elapsedRef.current + Math.floor((Date.now() - runStart) / 1000));
        setElapsed(elapsedRef.current);
      }
      runStartedAtRef.current = null;
      setRunning(false);
      if (elapsedRef.current >= totalSeconds) setCompleted(true);
    } else {
      runStartedAtRef.current = Date.now();
      setRunning(true);
    }
  }, [completed, saveStatus, running, totalSeconds]);

  const finishSession = useCallback(() => {
    Tts.stop();
    if (completed && saveStatus === "saved") {
      onClose(true);
      return;
    }
    if (completed) {
      Alert.alert("Session not saved", saveError ?? "Your completed session could not be saved. Please retry.", [
        { text: "Keep session", style: "cancel" },
        { text: "Retry save", onPress: () => void saveCompletedSession() },
      ]);
      return;
    }
    onClose(false);
  }, [completed, saveStatus, saveError, onClose, saveCompletedSession]);

  const resetSession = useCallback(() => {
    Tts.stop();
    elapsedRef.current = 0;
    runStartedAtRef.current = null;
    startedAtRef.current = null;
    sessionIdRef.current = null;
    savingRef.current = false;
    finishedRef.current = false;
    setStarted(false);
    setRunning(false);
    setElapsed(0);
    setScore(0);
    setCycles(0);
    setCompleted(false);
    setPlan(null);
    setSaveStatus("idle");
    setSaveError(null);
  }, []);

  const spin = particleRotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {ambientAudioUrl ? (
        <Video source={{ uri: ambientAudioUrl }} paused={!musicEnabled || !started || completed}
          repeat volume={0.22} muted={!musicEnabled} playInBackground={false}
          playWhenInactive={false} ignoreSilentSwitch="ignore" style={styles.audio} />
      ) : null}
      <LinearGradient colors={["#102F28", "#071B18", "#101D2A"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <Pressable onPress={finishSession} style={styles.headerButton}><ArrowLeft size={21} color={COLORS.text} /></Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerEyebrow}>WELLNESS AI</Text>
          <Text style={styles.headerTitle}>Mindful universe</Text>
        </View>
        <Pressable onPress={() => setMusicEnabled(v => !v)} style={styles.headerButton} accessibilityLabel={musicEnabled ? "Mute ambient music" : "Enable ambient music"}>
          {musicEnabled ? <Volume2 size={20} color={COLORS.mint} /> : <VolumeX size={20} color={COLORS.muted} />}
        </Pressable>
      </View>

      {!started ? (
        <View style={styles.setup}>
          <View style={styles.setupIcon}><Sparkles size={30} color={COLORS.green} /></View>
          <Text style={styles.title}>How are you feeling?</Text>
          <Text style={styles.subtitle}>Let's create a small moment that belongs entirely to you.</Text>
          <Text style={styles.fieldLabel}>YOUR CURRENT MOOD</Text>
          <View style={styles.moodRow}>
            {MOODS.map(item => <Pressable key={item.value} onPress={() => setMood(item.value)} style={[styles.moodOption, mood === item.value && styles.selectedOption]}>
              <Text style={styles.moodEmoji}>{item.emoji}</Text><Text style={styles.optionText}>{item.label}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.fieldLabel}>WHAT WOULD YOU LIKE?</Text>
          <View style={styles.goalGrid}>
            {GOALS.map(item => { const Icon = item.icon; const selected = goal === item.value; return (
              <Pressable key={item.value} onPress={() => setGoal(item.value)} style={[styles.goalOption, selected && styles.selectedGoal]}>
                <Icon size={19} color={selected ? COLORS.green : COLORS.muted} /><Text style={styles.goalText}>{item.label}</Text>{selected && <Check size={15} color={COLORS.green} />}
              </Pressable>
            ); })}
          </View>
          <Text style={styles.fieldLabel}>SESSION LENGTH</Text>
          <View style={styles.durationRow}>
            {[1, 3, 5, 10].map(minutes => <Pressable key={minutes} onPress={() => setDurationMinutes(minutes)} style={[styles.durationOption, durationMinutes === minutes && styles.selectedDuration]}>
              <Text style={[styles.durationText, durationMinutes === minutes && styles.selectedDurationText]}>{minutes} min</Text>
            </Pressable>)}
          </View>
          <Pressable onPress={() => void startSession()} disabled={generating} style={[styles.startButton, generating && { opacity: 0.7 }]}>
            {generating ? <ActivityIndicator color="#082017" /> : <><Sparkles size={19} color="#082017" /><Text style={styles.startButtonText}>Create my session</Text></>}
          </Pressable>
          <Text style={styles.privacyNote}>Your choices guide the session. You can stop or pause whenever you like.</Text>
        </View>
      ) : completed ? (
        <View style={styles.completeView}>
          <View style={styles.completeIcon}><Heart size={44} color={COLORS.green} /></View>
          <Text style={styles.completeEyebrow}>SESSION COMPLETE</Text>
          <Text style={styles.completeTitle}>You showed up for yourself.</Text>
          <Text style={styles.subtitle}>Take a moment before returning to your day.</Text>
          <View style={styles.scoreCard}>
            <View><Text style={styles.scoreNumber}>{score}</Text><Text style={styles.scoreLabel}>CALM POINTS</Text></View>
            <View style={styles.scoreDivider} />
            <View><Text style={styles.scoreNumber}>{cycles}</Text><Text style={styles.scoreLabel}>BREATH CYCLES</Text></View>
          </View>
          {saveStatus === "saving" && <View style={styles.saveMessage}><ActivityIndicator color={COLORS.green} /><Text style={styles.subtitle}>Saving your session on this device...</Text></View>}
          {saveStatus === "saved" && <Text style={[styles.saveSuccess]}>{saveError ? `✓ ${saveError}` : "✓ Session saved on this device"}</Text>}
          {saveStatus === "error" && <View style={styles.saveMessage}>
            <Text style={styles.saveError}>{saveError ?? "Unable to save your session."}</Text>
            <Pressable onPress={() => void saveCompletedSession()} disabled={savingRef.current} style={styles.finishButton}><Text style={styles.finishButtonText}>Retry saving session</Text></Pressable>
          </View>}
          <Pressable onPress={resetSession} disabled={saveStatus === "saving" || saveStatus === "error"} style={[styles.startButton, (saveStatus === "saving" || saveStatus === "error") && { opacity: 0.45 }]}>
            <Text style={styles.startButtonText}>Start another session</Text>
          </Pressable>
          <Pressable onPress={finishSession} disabled={saveStatus === "saving" || saveStatus === "error"} style={[styles.finishButton, (saveStatus === "saving" || saveStatus === "error") && { opacity: 0.45 }]}>
            <Text style={styles.finishButtonText}>Return to exercises</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.session}>
          <View style={styles.sessionTop}>
            <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>YOUR CALM SPACE</Text></View>
            <Text style={styles.sessionTitle}>{plan?.title ?? "Breathe with me"}</Text>
            <Text style={styles.sessionIntro}>{plan?.introduction ?? "Follow the light and relax."}</Text>
          </View>
          <View style={styles.orbStage}>
            <Animated.View style={[styles.orbit, styles.orbitOuter, { transform: [{ rotate: spin }] }]}><View style={[styles.orbitDot, styles.orbitDotTop]} /><View style={[styles.orbitDot, styles.orbitDotBottom]} /></Animated.View>
            <Animated.View style={[styles.orbit, styles.orbitInner, { transform: [{ rotate: spin }] }]}><View style={styles.smallStar} /></Animated.View>
            <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: orbScale }] }]} />
            <Animated.View style={[styles.orb, { backgroundColor: phaseColor, transform: [{ scale: orbScale }] }]}>
              <LinearGradient colors={["#E4FFF0", phaseColor, "#388B75"]} style={styles.orbGradient} />
              <View style={styles.orbShine} /><View style={styles.orbCore}><Wind size={36} color="#FFFFFF" /></View>
            </Animated.View>
          </View>
          <View style={styles.instructionWrap}>
            <Text style={[styles.phaseText, { color: phaseColor }]}>{getPhaseInstruction(phase).toUpperCase()}</Text>
            <Text style={styles.phaseHint}>{phase === "inhale" ? "Let the light expand" : phase === "exhale" ? "Let the light gently settle" : phase === "hold" ? "Stay soft. No need to force it." : "Relax your shoulders"}</Text>
          </View>
          <View style={styles.progressCard}>
            <View style={styles.progressTop}><Text style={styles.progressLabel}>TIME REMAINING</Text><Text style={styles.timer}>{formatTime(remaining)}</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
            <View style={styles.gameStats}>
              <View><Text style={styles.statValue}>{score}</Text><Text style={styles.statLabel}>CALM POINTS</Text></View>
              <View><Text style={styles.statValue}>{cycles}</Text><Text style={styles.statLabel}>CYCLES</Text></View>
              <View><Text style={styles.statValue}>{durationMinutes}m</Text><Text style={styles.statLabel}>SESSION</Text></View>
            </View>
          </View>
          <View style={styles.controls}>
            <Pressable onPress={() => setVoiceEnabled(v => !v)} style={styles.secondaryControl}>
              {voiceEnabled ? <Volume2 size={19} color={COLORS.mint} /> : <VolumeX size={19} color={COLORS.muted} />}<Text style={styles.controlText}>Voice</Text>
            </Pressable>
            <Pressable onPress={toggleSession} style={styles.pauseButton}>{running ? <Pause size={21} color="#082017" /> : <Play size={21} color="#082017" />}<Text style={styles.pauseText}>{running ? "Pause" : "Resume"}</Text></Pressable>
            <Pressable onPress={finishSession} style={styles.secondaryControl}><X size={19} color={COLORS.mint} /><Text style={styles.controlText}>End</Text></Pressable>
          </View>
          <Text style={styles.gameHint}>Complete a breathing cycle to earn 10 calm points ✨</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background, overflow: "hidden" },
  audio: { position: "absolute", width: 1, height: 1, opacity: 0.01 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  headerButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 2, color: COLORS.green },
  headerTitle: { marginTop: 3, fontSize: 15, fontWeight: "800", color: COLORS.text },
  setup: { flex: 1, paddingHorizontal: 23, justifyContent: "center" },
  setupIcon: { width: 62, height: 62, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(112,230,160,0.12)", borderWidth: 1, borderColor: "rgba(112,230,160,0.25)", marginBottom: 22 },
  title: { color: COLORS.text, fontSize: 29, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 21, marginTop: 9 },
  fieldLabel: { color: COLORS.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.7, marginTop: 25, marginBottom: 11 },
  moodRow: { flexDirection: "row", gap: 8 },
  moodOption: { flex: 1, minHeight: 76, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  selectedOption: { borderColor: COLORS.green, backgroundColor: "rgba(112,230,160,0.13)" },
  moodEmoji: { fontSize: 23 }, optionText: { color: COLORS.text, fontSize: 10, fontWeight: "700", marginTop: 6 },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  goalOption: { width: "48%", minHeight: 49, paddingHorizontal: 12, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  selectedGoal: { borderColor: COLORS.green, backgroundColor: "rgba(112,230,160,0.12)" },
  goalText: { flex: 1, color: COLORS.text, fontSize: 12, fontWeight: "700" },
  durationRow: { flexDirection: "row", gap: 9 },
  durationOption: { flex: 1, minHeight: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  selectedDuration: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  durationText: { color: COLORS.text, fontSize: 11, fontWeight: "800" }, selectedDurationText: { color: "#082017" },
  startButton: { minHeight: 55, borderRadius: 18, backgroundColor: COLORS.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 27, paddingHorizontal: 16 },
  startButtonText: { color: "#082017", fontSize: 14, fontWeight: "900" },
  privacyNote: { color: "#78978A", fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 13 },
  session: { flex: 1, paddingHorizontal: 22, paddingBottom: 20, justifyContent: "space-between" },
  sessionTop: { alignItems: "center", paddingTop: 13 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "rgba(112,230,160,0.1)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green }, liveText: { color: COLORS.green, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  sessionTitle: { color: COLORS.text, fontSize: 23, fontWeight: "900", marginTop: 15, textAlign: "center" },
  sessionIntro: { color: COLORS.muted, fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 7, maxWidth: 290 },
  orbStage: { height: 290, alignItems: "center", justifyContent: "center" },
  orbit: { position: "absolute", borderRadius: 200, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(180,245,210,0.23)", alignItems: "center", justifyContent: "center" },
  orbitOuter: { width: 270, height: 270 }, orbitInner: { width: 220, height: 220, borderStyle: "solid", borderColor: "rgba(180,245,210,0.13)" },
  orbitDot: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  orbitDotTop: { top: 21, right: 48 }, orbitDotBottom: { bottom: 39, left: 16, width: 7, height: 7, backgroundColor: COLORS.green },
  smallStar: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold, position: "absolute", top: 16, left: 42 },
  glow: { position: "absolute", width: 190, height: 190, borderRadius: 100, backgroundColor: "#53D99A", shadowColor: "#70E6A0", shadowOpacity: 0.9, shadowRadius: 45, elevation: 18 },
  orb: { width: 155, height: 155, borderRadius: 78, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.65)", elevation: 20, shadowColor: "#75E9AA", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  orbGradient: { ...StyleSheet.absoluteFillObject },
  orbShine: { position: "absolute", width: 78, height: 35, top: 17, left: 25, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.25)", transform: [{ rotate: "-35deg" }] },
  orbCore: { width: 75, height: 75, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  instructionWrap: { alignItems: "center", marginTop: -5 }, phaseText: { fontSize: 14, fontWeight: "900", letterSpacing: 2 }, phaseHint: { color: COLORS.muted, fontSize: 11, marginTop: 7 },
  progressCard: { padding: 17, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.065)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  progressLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  timer: { color: COLORS.text, fontSize: 19, fontWeight: "900", fontVariant: ["tabular-nums"] },
  progressTrack: { height: 6, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5, backgroundColor: COLORS.green },
  gameStats: { flexDirection: "row", justifyContent: "space-around", marginTop: 17 },
  statValue: { color: COLORS.mint, fontSize: 17, fontWeight: "900", textAlign: "center" },
  statLabel: { color: COLORS.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1, marginTop: 4 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 17 },
  secondaryControl: { minWidth: 65, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3 },
  controlText: { color: COLORS.muted, fontSize: 9, fontWeight: "700" },
  pauseButton: { minWidth: 145, minHeight: 52, borderRadius: 18, backgroundColor: COLORS.green, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  pauseText: { color: "#082017", fontSize: 13, fontWeight: "900" }, gameHint: { color: "#78978A", fontSize: 10, textAlign: "center", marginTop: 9 },
  completeView: { flex: 1, paddingHorizontal: 25, alignItems: "center", justifyContent: "center" },
  completeIcon: { width: 105, height: 105, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(112,230,160,0.13)", borderWidth: 1, borderColor: "rgba(112,230,160,0.25)", marginBottom: 25 },
  completeEyebrow: { color: COLORS.green, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  completeTitle: { color: COLORS.text, fontSize: 28, fontWeight: "900", textAlign: "center", marginTop: 12 },
  scoreCard: { width: "100%", flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", padding: 23, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginTop: 30 },
  scoreNumber: { color: COLORS.green, fontSize: 29, fontWeight: "900", textAlign: "center" },
  scoreLabel: { color: COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 5 },
  scoreDivider: { width: 1, height: 42, backgroundColor: "rgba(255,255,255,0.15)" },
  finishButton: { padding: 16, marginTop: 8 }, finishButtonText: { color: COLORS.muted, fontSize: 12, fontWeight: "700" },
  saveMessage: { alignItems: "center", marginTop: 16, gap: 7 },
  saveSuccess: { color: COLORS.green, fontSize: 11, textAlign: "center", marginTop: 15 },
  saveError: { color: "#FFB3A8", fontSize: 12, textAlign: "center" },
});
