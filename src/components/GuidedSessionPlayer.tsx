// src/components/GuidedSessionPlayer.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import LinearGradient from "react-native-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Tts from "react-native-tts";

import {
  getDatabase,
  initializeDatabase,
} from "../database/database";

// ============================================================================
// TYPES
// ============================================================================

type Step = {
  id: string;
  exercise_id: string;
  step_order: number;
  title: string;
  instruction: string;
  duration_seconds: number;
  animation_key: string | null;
  voice_prompt: string | null;
};

type StepDefinition = {
  title: string;
  instruction: string;
  duration: number;
  voice?: string;
};

type ExerciseInfo = {
  id: string;
  title: string;
  category: string;
  type: string;
};

type Props = {
  user: any;
  exercise: ExerciseInfo;
  onClose: () => void;
  onCompleted?: () => void;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  background: "#F3F8F3",
  forest: "#174D35",
  green: "#247A4A",
  greenLight: "#DCEFE0",
  sage: "#A9CBB1",
  text: "#20382A",
  muted: "#829187",
  white: "#FFFFFF",
  border: "#E3EDE4",
};

const SESSION_DURATION_SECONDS = 5 * 60;

const TIMER_INTERVAL_MS = 250;

// UUID-shaped identifiers for local records and Supabase UUID columns.
// These IDs are identifiers, not security tokens.
const createUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    character => {
      const random = Math.floor(Math.random() * 16);

      const value =
        character === "x"
          ? random
          : (random & 0x3) | 0x8;

      return value.toString(16);
    },
  );
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainder,
  ).padStart(2, "0")}`;
};

function normalise(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function getLocalDate(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ============================================================================
// BUILT-IN ROUTINES
// ============================================================================

const BUILT_IN_ROUTINES: Record<string, StepDefinition[]> = {
  deskstretch: [
    {
      title: "Neck Release",
      instruction:
        "Sit comfortably with your shoulders relaxed. Slowly tilt your right ear towards your right shoulder. Return to the centre and gently repeat on the left. Do not force the movement.",
      duration: 50,
      voice: "Relax your shoulders. Gently stretch your neck from side to side.",
    },
    {
      title: "Shoulder Rolls",
      instruction:
        "Let your arms rest naturally. Slowly roll both shoulders backwards in a circular motion. Repeat gently, then reverse the direction.",
      duration: 40,
      voice: "Roll your shoulders backwards, slowly and comfortably.",
    },
    {
      title: "Seated Upper Back Stretch",
      instruction:
        "Sit upright and bring your hands together in front of you. Reach forward gently, allowing your upper back to round. Breathe naturally.",
      duration: 45,
      voice: "Reach forward and gently stretch your upper back.",
    },
    {
      title: "Seated Side Stretch",
      instruction:
        "Sit tall. Raise your right arm and lean gently to the left. Return to the centre and switch sides. Keep both hips grounded.",
      duration: 50,
      voice: "Reach up and stretch gently to each side.",
    },
    {
      title: "Wrist and Hand Release",
      instruction:
        "Extend one arm forward and gently rotate your wrist. Open and close your fingers. Switch hands and repeat without pulling or forcing.",
      duration: 40,
      voice: "Relax your wrists and gently move your fingers.",
    },
    {
      title: "Seated Leg Extension",
      instruction:
        "Sit securely in your chair. Slowly extend one leg until it feels comfortable, then lower it. Repeat with the other leg. Keep the movement controlled.",
      duration: 45,
      voice: "Extend one leg at a time. Keep the movement gentle.",
    },
    {
      title: "Posture Reset",
      instruction:
        "Place both feet comfortably on the floor. Lengthen your spine, relax your shoulders and take a slow breath.",
      duration: 30,
      voice: "Sit tall, relax your shoulders and breathe.",
    },
  ],

  stretching: [
    {
      title: "Reach for the Sky",
      instruction:
        "Stand comfortably with your feet about hip-width apart. Slowly raise both arms overhead and reach upwards without arching your lower back.",
      duration: 40,
      voice: "Reach both arms towards the sky and stretch your whole body.",
    },
    {
      title: "Neck and Shoulder Stretch",
      instruction:
        "Relax your shoulders. Gently tilt your head from one side to the other, then roll your shoulders backwards.",
      duration: 35,
      voice: "Relax your neck and gently roll your shoulders.",
    },
    {
      title: "Chest Opener",
      instruction:
        "Bring your hands behind your back if comfortable. Gently draw your shoulders backwards and open your chest. Keep your neck relaxed.",
      duration: 40,
      voice: "Open your chest gently and draw your shoulders back.",
    },
    {
      title: "Standing Side Stretch",
      instruction:
        "Raise your right arm and gently lean to your left. Return to the centre and repeat on the opposite side. Avoid twisting your body.",
      duration: 40,
      voice: "Reach up and stretch gently from side to side.",
    },
    {
      title: "Hamstring Stretch",
      instruction:
        "Place one heel slightly forward with your toes pointing upwards. Keep your back straight and hinge gently at your hips until you feel a comfortable stretch. Switch legs.",
      duration: 45,
      voice: "Extend one leg and gently stretch the back of your thigh.",
    },
    {
      title: "Calf Stretch",
      instruction:
        "Place one foot behind the other. Keep your back heel grounded and gently bend your front knee. Switch sides.",
      duration: 40,
      voice: "Gently stretch your calves, one side at a time.",
    },
    {
      title: "Gentle Torso Rotation",
      instruction:
        "Stand tall with your hands resting comfortably at your sides. Slowly rotate your upper body a little to the right, return to the centre, then turn left.",
      duration: 35,
      voice: "Rotate your upper body gently from side to side.",
    },
    {
      title: "Full Body Relaxation",
      instruction:
        "Return to a comfortable standing position. Let your arms rest, relax your shoulders and take a slow natural breath.",
      duration: 25,
      voice: "Relax your whole body and take a comfortable breath.",
    },
  ],

  gratitudejournal: [
    {
      title: "Settle In",
      instruction:
        "Find a comfortable position. Take a moment to slow down and bring your attention to the present.",
      duration: 45,
    },
    {
      title: "One Good Thing",
      instruction:
        "Think of one thing that went well today, even if it was something very small.",
      duration: 60,
    },
    {
      title: "Someone You Appreciate",
      instruction:
        "Bring to mind someone who has made your life a little better. Think about what you appreciate about them.",
      duration: 60,
    },
    {
      title: "Something About Yourself",
      instruction:
        "Think of one quality, effort or small achievement in yourself that you are grateful for.",
      duration: 60,
    },
    {
      title: "Carry It Forward",
      instruction:
        "Choose one positive thought you would like to carry with you for the rest of today.",
      duration: 75,
    },
  ],

  thoughtreset: [
    {
      title: "Pause",
      instruction:
        "Take a comfortable breath. Give yourself permission to pause without needing to solve everything immediately.",
      duration: 45,
    },
    {
      title: "Notice the Thought",
      instruction:
        "Identify the thought that has been taking up your attention. Notice it without judging yourself.",
      duration: 60,
    },
    {
      title: "Separate Facts from Assumptions",
      instruction:
        "Ask yourself what you know for certain and what you might be assuming.",
      duration: 60,
    },
    {
      title: "Find Another Perspective",
      instruction:
        "Consider another possible explanation. Choose a more balanced way to look at the situation.",
      duration: 75,
    },
    {
      title: "Choose Your Next Step",
      instruction:
        "Focus on one small action that is within your control. Let the rest wait for now.",
      duration: 60,
    },
  ],

  mindfulnessmoment: [
    {
      title: "Arrive in the Present",
      instruction:
        "Sit comfortably. Notice that you are here, in this moment. Allow your body to settle.",
      duration: 45,
    },
    {
      title: "Notice Your Breathing",
      instruction:
        "Pay attention to the natural rhythm of your breathing. There is no need to change it.",
      duration: 60,
    },
    {
      title: "Notice Your Body",
      instruction:
        "Notice where your body touches the chair or floor. Relax any muscles that feel unnecessarily tense.",
      duration: 60,
    },
    {
      title: "Notice Your Surroundings",
      instruction:
        "Gently notice the sounds around you. Let them come and go without needing to follow them.",
      duration: 60,
    },
    {
      title: "Return to Now",
      instruction:
        "Bring your attention back to your breathing. Take one comfortable breath and continue your day.",
      duration: 75,
    },
  ],

  bodyscan: [
    {
      title: "Relax Your Face",
      instruction:
        "Close your eyes if comfortable. Relax your forehead, jaw and the muscles around your eyes.",
      duration: 40,
    },
    {
      title: "Release Your Shoulders",
      instruction:
        "Notice your shoulders. Let them drop naturally and release any unnecessary tension.",
      duration: 40,
    },
    {
      title: "Notice Your Arms",
      instruction:
        "Bring your attention to your upper arms, elbows, forearms and hands. Allow them to feel relaxed.",
      duration: 45,
    },
    {
      title: "Relax Your Chest and Back",
      instruction:
        "Notice your chest and back moving naturally with each breath. Avoid forcing your breathing.",
      duration: 45,
    },
    {
      title: "Relax Your Hips and Legs",
      instruction:
        "Bring awareness to your hips, thighs, knees and lower legs. Allow the muscles to soften.",
      duration: 45,
    },
    {
      title: "Relax Your Feet",
      instruction:
        "Notice your ankles, feet and toes. Let them rest comfortably.",
      duration: 40,
    },
    {
      title: "Whole Body Awareness",
      instruction:
        "Notice your whole body as one. Take a comfortable breath and remain present.",
      duration: 45,
    },
  ],

  focustraining: [
    {
      title: "Clear Your Space",
      instruction:
        "Settle into a comfortable position. Decide on one task or intention you want to focus on.",
      duration: 45,
    },
    {
      title: "Choose One Priority",
      instruction:
        "Identify the most important part of that task. Let other tasks wait for the moment.",
      duration: 60,
    },
    {
      title: "Focus on Your Breathing",
      instruction:
        "Notice five natural breaths. When your attention wanders, gently bring it back.",
      duration: 60,
    },
    {
      title: "Visualise the First Step",
      instruction:
        "Imagine yourself beginning the task calmly and completing its first small step.",
      duration: 60,
    },
    {
      title: "Make a Simple Commitment",
      instruction:
        "Choose one action you can take next. Begin with that rather than thinking about everything at once.",
      duration: 75,
    },
  ],

  boxbreathing: [
    {
      title: "Breathe In",
      instruction:
        "Gently breathe in through your nose for four seconds, only as deeply as feels comfortable.",
      duration: 4,
      voice: "Breathe in slowly.",
    },
    {
      title: "Hold",
      instruction:
        "Pause gently for four seconds. Do not strain or force yourself to hold your breath.",
      duration: 4,
      voice: "Hold gently.",
    },
    {
      title: "Breathe Out",
      instruction:
        "Slowly breathe out for four seconds, allowing your shoulders to relax.",
      duration: 4,
      voice: "Breathe out slowly.",
    },
    {
      title: "Pause",
      instruction:
        "Rest comfortably for four seconds before beginning the next cycle. Breathe normally if needed.",
      duration: 4,
      voice: "Rest and relax.",
    },
  ],

  deepbreathing: [
    {
      title: "Settle Your Breathing",
      instruction:
        "Sit comfortably and relax your shoulders. Allow your breathing to become natural.",
      duration: 30,
    },
    {
      title: "Gentle Inhale",
      instruction:
        "Breathe in slowly through your nose. Keep the breath comfortable rather than taking a forced deep breath.",
      duration: 5,
      voice: "Breathe in slowly.",
    },
    {
      title: "Slow Exhale",
      instruction:
        "Gently breathe out. Allow your body to release tension as you exhale.",
      duration: 7,
      voice: "Breathe out gently.",
    },
    {
      title: "Natural Breathing",
      instruction:
        "Return to normal breathing. Notice how your body feels.",
      duration: 30,
    },
  ],

  musclerelaxation: [
    {
      title: "Relax Your Hands",
      instruction:
        "Gently close your hands into loose fists, then release. Avoid squeezing hard.",
      duration: 40,
    },
    {
      title: "Relax Your Arms",
      instruction:
        "Gently tense your arm muscles for a moment, then release completely. Skip this step if uncomfortable.",
      duration: 40,
    },
    {
      title: "Relax Your Shoulders",
      instruction:
        "Lift your shoulders slightly towards your ears, then let them drop and relax.",
      duration: 40,
    },
    {
      title: "Relax Your Face",
      instruction:
        "Soften your forehead, eyes and jaw. Allow your facial muscles to rest.",
      duration: 40,
    },
    {
      title: "Relax Your Legs",
      instruction:
        "Gently tighten your thigh muscles for a moment, then release. Keep your breathing natural.",
      duration: 45,
    },
    {
      title: "Whole Body Relaxation",
      instruction:
        "Allow your entire body to rest. Notice the difference between tension and relaxation.",
      duration: 95,
    },
  ],

  peacefulvisualization: [
    {
      title: "Get Comfortable",
      instruction:
        "Close your eyes if comfortable. Take a natural breath and let your body settle.",
      duration: 45,
    },
    {
      title: "Imagine a Peaceful Place",
      instruction:
        "Picture a place where you feel calm and comfortable. It could be a beach, garden or quiet room.",
      duration: 60,
    },
    {
      title: "Notice the Details",
      instruction:
        "Imagine the colours, light and surroundings. Let the scene become clear in your mind.",
      duration: 60,
    },
    {
      title: "Experience the Calm",
      instruction:
        "Imagine the peaceful sounds and sensations of this place. Allow yourself to enjoy the moment.",
      duration: 75,
    },
    {
      title: "Return Gently",
      instruction:
        "Take a comfortable breath. Slowly bring your attention back to the room around you.",
      duration: 60,
    },
  ],

  sleeprelaxation: [
    {
      title: "Prepare to Rest",
      instruction:
        "Get comfortable and allow your body to settle. Let your hands rest naturally.",
      duration: 45,
    },
    {
      title: "Slow Your Thoughts",
      instruction:
        "Notice any thoughts that appear. You do not need to follow them. Let them pass gently.",
      duration: 60,
    },
    {
      title: "Relax Your Face",
      instruction:
        "Release tension around your eyes, forehead and jaw. Allow your face to feel soft.",
      duration: 45,
    },
    {
      title: "Relax Your Body",
      instruction:
        "Let your shoulders, arms, back and legs become comfortable and still.",
      duration: 60,
    },
    {
      title: "Rest with Your Breathing",
      instruction:
        "Notice your natural breathing. There is nothing you need to achieve right now.",
      duration: 90,
    },
  ],

  walkingsession: [
    {
      title: "Begin Slowly",
      instruction:
        "Stand comfortably and begin walking at an easy pace in a safe space.",
      duration: 45,
    },
    {
      title: "Find Your Rhythm",
      instruction:
        "Continue walking at a comfortable pace. Let your arms move naturally.",
      duration: 60,
    },
    {
      title: "Notice Your Steps",
      instruction:
        "Pay attention to how each foot meets the ground. Keep your posture comfortable.",
      duration: 60,
    },
    {
      title: "Relax Your Upper Body",
      instruction:
        "Keep your shoulders relaxed and your breathing natural as you continue walking.",
      duration: 60,
    },
    {
      title: "Slow Down",
      instruction:
        "Gradually reduce your pace. Finish with a comfortable final few steps.",
      duration: 75,
    },
  ],

  situpchallenge: [
    {
      title: "Prepare Your Position",
      instruction:
        "Lie on a comfortable exercise mat with your knees bent and feet supported. Keep your neck relaxed.",
      duration: 45,
    },
    {
      title: "Begin with a Gentle Movement",
      instruction:
        "Lift your upper shoulders slightly using your abdominal muscles. Avoid pulling your head or neck.",
      duration: 45,
    },
    {
      title: "Controlled Repetitions",
      instruction:
        "If comfortable, perform a few small controlled crunches. Keep your movements slow and stop if you feel pain.",
      duration: 60,
    },
    {
      title: "Rest",
      instruction:
        "Lower your shoulders and relax. Breathe normally before continuing.",
      duration: 45,
    },
    {
      title: "Final Controlled Set",
      instruction:
        "Repeat a few comfortable crunches if you feel able. Quality of movement matters more than the number.",
      duration: 60,
    },
    {
      title: "Recover",
      instruction:
        "Rest comfortably and allow your breathing to return to normal.",
      duration: 45,
    },
  ],

  squatchallenge: [
    {
      title: "Set Your Stance",
      instruction:
        "Stand with your feet about shoulder-width apart. Keep your chest comfortable and your feet firmly supported.",
      duration: 40,
    },
    {
      title: "Practice Your Squat",
      instruction:
        "Bend your knees and hips gently as if sitting into a chair. Keep your movement within a comfortable range.",
      duration: 45,
    },
    {
      title: "Controlled Squats",
      instruction:
        "Perform a few slow squats. Keep your knees tracking in the same direction as your toes.",
      duration: 60,
    },
    {
      title: "Rest and Reset",
      instruction:
        "Stand comfortably and rest. Take a natural breath.",
      duration: 45,
    },
    {
      title: "Final Squat Set",
      instruction:
        "Repeat a few controlled squats if comfortable. You can use a chair for support.",
      duration: 65,
    },
    {
      title: "Cool Down",
      instruction:
        "Stand tall, relax your legs and allow your breathing to settle.",
      duration: 45,
    },
  ],

  moodreset: [
    {
      title: "Pause for Yourself",
      instruction:
        "Take a moment away from distractions. Sit comfortably and notice how you feel.",
      duration: 45,
    },
    {
      title: "Name Your Feeling",
      instruction:
        "Identify the emotion you are experiencing. There is no right or wrong feeling.",
      duration: 60,
    },
    {
      title: "Release Some Tension",
      instruction:
        "Relax your shoulders and hands. Take a comfortable breath without forcing it.",
      duration: 60,
    },
    {
      title: "Find Something Positive",
      instruction:
        "Think of one small thing that gives you comfort, hope or a sense of appreciation.",
      duration: 60,
    },
    {
      title: "Choose Your Next Step",
      instruction:
        "Decide on one gentle action that could make the rest of your day a little easier.",
      duration: 75,
    },
  ],
};

// ============================================================================
// BUILT-IN STEP CONVERSION
// ============================================================================

function createSteps(
  exerciseId: string,
  definitions: StepDefinition[],
): Step[] {
  return definitions.map((definition, index) => ({
    id: `builtin_${exerciseId}_${index + 1}`,
    exercise_id: exerciseId,
    step_order: index + 1,
    title: definition.title,
    instruction: definition.instruction,
    duration_seconds: definition.duration,
    animation_key: null,
    voice_prompt: definition.voice || definition.instruction,
  }));
}

// ============================================================================
// ROUTINE RESOLUTION
// ============================================================================

function getBuiltInSteps(exercise: ExerciseInfo): Step[] {
  const id = normalise(exercise.id);
  const title = normalise(exercise.title);

  const aliases: Record<string, string> = {
    deskstretch: "deskstretch",
    deskstretching: "deskstretch",
    officestretch: "deskstretch",
    officestretching: "deskstretch",

    stretching: "stretching",
    fullbodystretch: "stretching",
    fullbodystretching: "stretching",
    bodystretch: "stretching",

    gratitudejournal: "gratitudejournal",
    gratitudjournal: "gratitudejournal",
    thoughtreset: "thoughtreset",
    mindfulnessmoment: "mindfulnessmoment",
    mindfulness: "mindfulnessmoment",
    bodyscan: "bodyscan",
    focustraining: "focustraining",
    moodreset: "moodreset",

    boxbreathing: "boxbreathing",
    deepbreathing: "deepbreathing",
    musclerelaxation: "musclerelaxation",
    peacefulvisualization: "peacefulvisualization",
    peacefulvisualisation: "peacefulvisualization",
    sleeprelaxation: "sleeprelaxation",

    walkingsession: "walkingsession",
    walking: "walkingsession",
    situpchallenge: "situpchallenge",
    squatchallenge: "squatchallenge",
  };

  let routineKey = aliases[id] || aliases[title] || "";

  if (!routineKey) {
    if (title.includes("desk") && title.includes("stretch")) {
      routineKey = "deskstretch";
    } else if (
      title.includes("fullbody") ||
      (title.includes("full") && title.includes("stretch"))
    ) {
      routineKey = "stretching";
    } else if (title.includes("box") && title.includes("breath")) {
      routineKey = "boxbreathing";
    } else if (title.includes("deep") && title.includes("breath")) {
      routineKey = "deepbreathing";
    } else if (title.includes("gratitude")) {
      routineKey = "gratitudejournal";
    } else if (title.includes("thought")) {
      routineKey = "thoughtreset";
    } else if (title.includes("mindfulness")) {
      routineKey = "mindfulnessmoment";
    } else if (title.includes("body") && title.includes("scan")) {
      routineKey = "bodyscan";
    } else if (title.includes("focus")) {
      routineKey = "focustraining";
    } else if (title.includes("muscle")) {
      routineKey = "musclerelaxation";
    } else if (
      title.includes("peaceful") ||
      title.includes("visual")
    ) {
      routineKey = "peacefulvisualization";
    } else if (title.includes("sleep")) {
      routineKey = "sleeprelaxation";
    } else if (title.includes("walk")) {
      routineKey = "walkingsession";
    } else if (title.includes("situp")) {
      routineKey = "situpchallenge";
    } else if (title.includes("squat")) {
      routineKey = "squatchallenge";
    } else if (title.includes("mood")) {
      routineKey = "moodreset";
    }
  }

  if (!routineKey || !BUILT_IN_ROUTINES[routineKey]) {
    const category = normalise(exercise.category);

    if (category === "physical") {
      routineKey = "stretching";
    } else if (category === "sleep") {
      routineKey = "sleeprelaxation";
    } else {
      routineKey = "mindfulnessmoment";
    }
  }

  return createSteps(
    exercise.id,
    BUILT_IN_ROUTINES[routineKey],
  );
}

// ============================================================================
// ATOMIC SESSION + ACTIVITY + QUEUE SAVE
// ============================================================================

function saveCompletedSessionLocally(
  db: ReturnType<typeof getDatabase>,
  record: {
    id: string;
    user_id: string;
    exercise_id: string;
    session_type: string;
    category: string | null;
    duration_seconds: number;
    completed: number;
    mood_before: number | null;
    mood_after: number | null;
    notes: string | null;
    metadata: string;
    started_at: string;
    completed_at: string;
    created_at: string;
    synced: number;
  },
  activityId: string,
  sessionQueueId: string,
  activityQueueId: string,
): void {
  const now = record.completed_at;

  const activity = {
    id: activityId,
    user_id: record.user_id,
    activity_type: record.session_type,
    activity_date: getLocalDate(),
    duration_minutes: Math.ceil(record.duration_seconds / 60),
    completed: 1,
    created_at: now,
    synced: 0,
  };

  db.execute("BEGIN IMMEDIATE TRANSACTION");

  try {
    db.execute(
      `INSERT INTO wellness_sessions (
        id,
        user_id,
        exercise_id,
        session_type,
        category,
        duration_seconds,
        completed,
        mood_before,
        mood_after,
        notes,
        metadata,
        started_at,
        completed_at,
        created_at,
        synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.user_id,
        record.exercise_id,
        record.session_type,
        record.category,
        record.duration_seconds,
        record.completed,
        record.mood_before,
        record.mood_after,
        record.notes,
        record.metadata,
        record.started_at,
        record.completed_at,
        record.created_at,
        record.synced,
      ],
    );

    db.execute(
      `INSERT INTO daily_activities (
        id,
        user_id,
        activity_type,
        activity_date,
        duration_minutes,
        completed,
        created_at,
        synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activity.id,
        activity.user_id,
        activity.activity_type,
        activity.activity_date,
        activity.duration_minutes,
        activity.completed,
        activity.created_at,
        activity.synced,
      ],
    );

    const queueEntries = [
      {
        id: sessionQueueId,
        tableName: "wellness_sessions",
        recordId: record.id,
        payload: JSON.stringify(record),
      },
      {
        id: activityQueueId,
        tableName: "daily_activities",
        recordId: activity.id,
        payload: JSON.stringify(activity),
      },
    ];

    for (const entry of queueEntries) {
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
          entry.id,
          entry.tableName,
          entry.recordId,
          record.user_id,
          "INSERT",
          entry.payload,
          "pending",
          0,
          null,
          now,
          now,
        ],
      );
    }

    db.execute("COMMIT");
  } catch (error) {
    try {
      db.execute("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[GuidedSession] SQLite rollback failed:",
        rollbackError,
      );
    }

    throw error;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GuidedSessionPlayer({
  user,
  exercise,
  onClose,
  onCompleted,
}: Props) {
  const insets = useSafeAreaInsets();

  const [steps, setSteps] = useState<Step[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [usingBuiltIn, setUsingBuiltIn] = useState(false);

  const currentIndexRef = useRef(0);
  const remainingRef = useRef(0);
  const elapsedRef = useRef(0);

  const stepsRef = useRef<Step[]>([]);

  const finishedRef = useRef(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);

  const startedAtRef = useRef(new Date().toISOString());

  const lastTickAtRef = useRef<number | null>(null);

  const tickRemainderMsRef = useRef(0);

  const pulse = useRef(new Animated.Value(0)).current;

  // ==========================================================================
  // ANIMATION
  // ==========================================================================

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  // ==========================================================================
  // TEXT TO SPEECH
  // ==========================================================================

  useEffect(() => {
    mountedRef.current = true;

    async function setupSpeech() {
      try {
        await Tts.getInitStatus();

        if (!mountedRef.current) return;

        Tts.setDefaultRate(0.42);
        Tts.setDefaultPitch(0.92);

        try {
          const voices = await Tts.voices();

          if (!mountedRef.current || !Array.isArray(voices)) {
            return;
          }

          const englishVoice = voices.find(
            (voice: any) =>
              voice.language?.toLowerCase().startsWith("en") &&
              !voice.notInstalled &&
              !voice.networkConnectionRequired,
          );

          if (englishVoice?.id) {
            Tts.setDefaultVoice(englishVoice.id);
          }
        } catch (error) {
          console.warn(
            "[GuidedSession] Could not select voice:",
            error,
          );
        }
      } catch (error) {
        console.warn(
          "[GuidedSession] Speech engine unavailable:",
          error,
        );
      }
    }

    void setupSpeech();

    return () => {
      mountedRef.current = false;
      Tts.stop();
    };
  }, []);

  const speak = useCallback((text: string | null) => {
    if (!text?.trim()) return;

    try {
      Tts.stop();
      Tts.speak(text.trim());
    } catch (error) {
      console.warn(
        "[GuidedSession] Speech failed:",
        error,
      );
    }
  }, []);

  // ==========================================================================
  // LOAD INSTRUCTIONS
  // ==========================================================================

  useEffect(() => {
    let cancelled = false;

    async function loadSteps() {
      setLoading(true);
      setLoadError("");
      setUsingBuiltIn(false);

      try {
        await initializeDatabase();

        const db = getDatabase();

        let localSteps: Step[] = [];

        try {
          const result = db.execute<Step>(
            `SELECT
              id,
              exercise_id,
              step_order,
              title,
              instruction,
              duration_seconds,
              animation_key,
              voice_prompt
            FROM exercise_steps
            WHERE exercise_id = ?
            ORDER BY step_order ASC`,
            [exercise.id],
          );

          localSteps = (result.rows?._array || []).filter(
            step =>
              Number(step.duration_seconds) > 0 &&
              Boolean(step.instruction),
          );
        } catch (databaseError) {
          console.warn(
            "[GuidedSession] Could not read downloaded instructions:",
            databaseError,
          );
        }

        if (cancelled) return;

        let selectedSteps = localSteps;
        let builtInSelected = false;

        if (selectedSteps.length === 0) {
          selectedSteps = getBuiltInSteps(exercise);
          builtInSelected = true;
        }

        if (selectedSteps.length === 0) {
          setSteps([]);
          setLoadError(
            "Instructions are not available for this exercise.",
          );
          setLoading(false);
          return;
        }

        stepsRef.current = selectedSteps;

        currentIndexRef.current = 0;

        remainingRef.current = Math.max(
          1,
          Number(selectedSteps[0].duration_seconds) || 1,
        );

        elapsedRef.current = 0;

        finishedRef.current = false;
        savingRef.current = false;

        lastTickAtRef.current = null;
        tickRemainderMsRef.current = 0;

        startedAtRef.current = new Date().toISOString();

        setSteps(selectedSteps);
        setCurrentIndex(0);
        setRemaining(remainingRef.current);
        setElapsed(0);

        setPaused(false);
        setSaving(false);
        setUsingBuiltIn(builtInSelected);
        setLoading(false);
      } catch (error: any) {
        console.error(
          "[GuidedSession] Could not prepare exercise:",
          error,
        );

        if (cancelled) return;

        const fallback = getBuiltInSteps(exercise);

        if (fallback.length > 0) {
          stepsRef.current = fallback;
          currentIndexRef.current = 0;

          remainingRef.current = Math.max(
            1,
            Number(fallback[0].duration_seconds) || 1,
          );

          elapsedRef.current = 0;

          finishedRef.current = false;
          savingRef.current = false;

          lastTickAtRef.current = null;
          tickRemainderMsRef.current = 0;

          startedAtRef.current = new Date().toISOString();

          setSteps(fallback);
          setCurrentIndex(0);
          setRemaining(remainingRef.current);
          setElapsed(0);

          setPaused(false);
          setSaving(false);
          setUsingBuiltIn(true);
          setLoading(false);
        } else {
          setLoadError(
            error?.message ||
              "Unable to prepare this exercise.",
          );
          setLoading(false);
        }
      }
    }

    void loadSteps();

    return () => {
      cancelled = true;
      Tts.stop();
    };
  }, [
    exercise.id,
    exercise.title,
    exercise.category,
    exercise.type,
  ]);

  // ==========================================================================
  // COMPLETE AND SAVE SESSION
  // ==========================================================================

  const completeSession = useCallback(async () => {
    if (
      finishedRef.current ||
      savingRef.current ||
      elapsedRef.current < SESSION_DURATION_SECONDS
    ) {
      return;
    }

    // Lock immediately to prevent double taps or duplicate timer calls.
    savingRef.current = true;
    finishedRef.current = true;

    setPaused(true);
    setSaving(true);

    Tts.stop();

    try {
      if (!user?.id) {
        throw new Error(
          "Your user ID is unavailable. Sign in before saving this session.",
        );
      }

      await initializeDatabase();

      const db = getDatabase();

      const sessionId = createUUID();
      const activityId = createUUID();

      const sessionQueueId = createUUID();
      const activityQueueId = createUUID();

      const completedAt = new Date().toISOString();

      const record = {
        id: sessionId,
        user_id: user.id,
        exercise_id: exercise.id,
        session_type: exercise.type || "guided",
        category: exercise.category || null,

        duration_seconds: SESSION_DURATION_SECONDS,
        completed: 1,

        mood_before: null,
        mood_after: null,
        notes: null,

        metadata: JSON.stringify({
          source: usingBuiltIn
            ? "guided_player_builtin"
            : "guided_player_downloaded",

          instructions_source: usingBuiltIn
            ? "built_in"
            : "sqlite",

          steps_available: stepsRef.current.length,

          session_duration_seconds:
            SESSION_DURATION_SECONDS,

          offline: true,
        }),

        started_at: startedAtRef.current,
        completed_at: completedAt,
        created_at: completedAt,

        synced: 0,
      };

      // Session, daily activity and both queue entries
      // are committed together or not saved at all.
      saveCompletedSessionLocally(
        db,
        record,
        activityId,
        sessionQueueId,
        activityQueueId,
      );

      console.log(
        "[GuidedSession] Session and activity saved locally",
        {
          sessionId,
          activityId,
          durationSeconds: SESSION_DURATION_SECONDS,
          queueEntries: 2,
          instructionsSource: usingBuiltIn
            ? "built_in"
            : "sqlite",
        },
      );

      Alert.alert(
        "Beautiful work 🌿",
        "Your five-minute session and daily activity have been saved on this device. Both are queued for cloud backup when synchronisation runs online.",
        [
          {
            text: "Done",
            onPress: () => {
              onCompleted?.();
              onClose();
            },
          },
        ],
      );
    } catch (error: any) {
      // Allow retry only if the SQLite transaction failed.
      finishedRef.current = false;

      console.error(
        "[GuidedSession] Failed to save session:",
        error,
      );

      Alert.alert(
        "Couldn't save your session",
        error?.message ||
          "Your session could not be saved. Please try again.",
      );
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    exercise,
    user,
    onCompleted,
    onClose,
    usingBuiltIn,
  ]);

  // ==========================================================================
  // FIVE-MINUTE TIMER
  // ==========================================================================

  useEffect(() => {
    if (
      loading ||
      paused ||
      saving ||
      steps.length === 0
    ) {
      lastTickAtRef.current = null;
      return;
    }

    lastTickAtRef.current = Date.now();

    const timer = setInterval(() => {
      if (
        finishedRef.current ||
        savingRef.current
      ) {
        return;
      }

      const now = Date.now();

      const previousTick =
        lastTickAtRef.current ?? now;

      lastTickAtRef.current = now;

      const deltaMs = Math.max(
        0,
        now - previousTick,
      );

      tickRemainderMsRef.current += deltaMs;

      const wholeSeconds = Math.floor(
        tickRemainderMsRef.current / 1000,
      );

      if (wholeSeconds <= 0) return;

      tickRemainderMsRef.current -=
        wholeSeconds * 1000;

      for (
        let second = 0;
        second < wholeSeconds;
        second += 1
      ) {
        if (
          elapsedRef.current >=
            SESSION_DURATION_SECONDS ||
          finishedRef.current ||
          savingRef.current
        ) {
          break;
        }

        elapsedRef.current += 1;

        if (
          elapsedRef.current >=
          SESSION_DURATION_SECONDS
        ) {
          elapsedRef.current =
            SESSION_DURATION_SECONDS;

          remainingRef.current = 0;

          if (mountedRef.current) {
            setElapsed(SESSION_DURATION_SECONDS);
            setRemaining(0);
          }

          void completeSession();
          break;
        }

        remainingRef.current -= 1;

        if (remainingRef.current <= 0) {
          const nextIndex =
            (currentIndexRef.current + 1) %
            stepsRef.current.length;

          currentIndexRef.current = nextIndex;

          const nextStep =
            stepsRef.current[nextIndex];

          remainingRef.current = Math.max(
            1,
            Number(nextStep.duration_seconds) || 1,
          );

          if (mountedRef.current) {
            setCurrentIndex(nextIndex);
            setRemaining(remainingRef.current);
          }

          speak(
            nextStep.voice_prompt ||
              nextStep.title,
          );
        } else if (mountedRef.current) {
          setRemaining(remainingRef.current);
        }
      }

      if (mountedRef.current) {
        setElapsed(elapsedRef.current);
      }
    }, TIMER_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      lastTickAtRef.current = null;
    };
  }, [
    loading,
    paused,
    saving,
    steps.length,
    completeSession,
    speak,
  ]);

  // ==========================================================================
  // LOADING SCREEN
  // ==========================================================================

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle="dark-content" />

        <ActivityIndicator
          size="large"
          color={COLORS.green}
        />

        <Text style={styles.loadingText}>
          Preparing your guided session…
        </Text>
      </View>
    );
  }

  // ==========================================================================
  // ERROR SCREEN
  // ==========================================================================

  if (loadError || steps.length === 0) {
    return (
      <View
        style={[
          styles.center,
          { paddingTop: insets.top + 20 },
        ]}
      >
        <StatusBar barStyle="dark-content" />

        <Text style={styles.errorEmoji}>🌱</Text>

        <Text style={styles.errorTitle}>
          Let's prepare your session
        </Text>

        <Text style={styles.errorText}>
          {loadError ||
            "Instructions are not available for this exercise."}
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================================================
  // SESSION UI
  // ==========================================================================

  const step = steps[currentIndex];

  const progress = Math.min(
    1,
    elapsed / SESSION_DURATION_SECONDS,
  );

  const overallRemaining = Math.max(
    0,
    SESSION_DURATION_SECONDS - elapsed,
  );

  const orbScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.06],
  });

  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.65],
  });

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
      />

      <LinearGradient
        colors={[
          "#F7FBF6",
          "#EFF7F0",
          "#E8F3E9",
        ]}
        style={[
          styles.gradient,
          {
            paddingTop: insets.top + 8,
            paddingBottom:
              Math.max(insets.bottom, 16) + 14,
          },
        ]}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close guided session"
            disabled={saving}
            onPress={() => {
              Tts.stop();
              onClose();
            }}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>×</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>
              YOUR WELLNESS MOMENT
            </Text>

            <Text
              style={styles.headerTitle}
              numberOfLines={1}
            >
              {exercise.title}
            </Text>
          </View>

          <View style={styles.headerButton}>
            <Text style={styles.soundIcon}>♫</Text>
          </View>
        </View>

        {/* SESSION PROGRESS */}

        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>

          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>
              STEP {currentIndex + 1} OF {steps.length}
            </Text>

            <Text style={styles.progressLabel}>
              {formatTime(overallRemaining)} LEFT
            </Text>
          </View>
        </View>

        {/* FOCUS AREA */}

        <View style={styles.focusArea}>
          <Text style={styles.focusEyebrow}>
            {paused ? "RESTING" : "BE PRESENT"}
          </Text>

          <View style={styles.orbContainer}>
            <Animated.View
              style={[
                styles.orbHalo,
                {
                  opacity: haloOpacity,
                  transform: [{ scale: orbScale }],
                },
              ]}
            />

            <Animated.View
              style={[
                styles.orbOuter,
                { transform: [{ scale: orbScale }] },
              ]}
            >
              <LinearGradient
                colors={[
                  "#BBDCC0",
                  "#7DBA8A",
                  "#3D8B5B",
                ]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.orbGradient}
              >
                <View style={styles.orbInnerRing}>
                  <Text style={styles.orbLeaf}>
                    ✦
                  </Text>

                  <Text style={styles.orbText}>
                    {paused ? "Rest" : "Breathe"}
                  </Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>

          <Text style={styles.stepTitle}>
            {step.title}
          </Text>

          <Text style={styles.stepInstruction}>
            {step.instruction}
          </Text>

          <View style={styles.timerPill}>
            <View style={styles.timerDot} />

            <Text style={styles.timerText}>
              NEXT CHANGE IN {remaining}s
            </Text>
          </View>

          <Text style={styles.sessionCountdownLabel}>
            TOTAL SESSION TIME REMAINING
          </Text>

          <Text style={styles.sessionCountdown}>
            {formatTime(overallRemaining)}
          </Text>
        </View>

        {/* INSTRUCTIONS SOURCE */}

        <View style={styles.guidanceCard}>
          <View style={styles.guidanceIcon}>
            <Text style={styles.guidanceIconText}>
              ♫
            </Text>
          </View>

          <View style={styles.guidanceContent}>
            <Text style={styles.guidanceTitle}>
              {usingBuiltIn
                ? "Built-in offline instructions"
                : "Downloaded exercise instructions"}
            </Text>

            <Text style={styles.guidanceSubtitle}>
              {paused
                ? "Take your time. Resume whenever you're ready."
                : usingBuiltIn
                  ? "Your instructions are available directly on this device."
                  : "Follow the saved guidance at your own pace."}
            </Text>
          </View>

          <View style={styles.offlineBadge}>
            <View style={styles.offlineDot} />

            <Text style={styles.offlineText}>
              OFFLINE
            </Text>
          </View>
        </View>

        {/* CONTROLS */}

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.secondaryButton}
            disabled={saving}
            activeOpacity={0.8}
            onPress={() => {
              if (paused) {
                lastTickAtRef.current = null;
                setPaused(false);

                speak(
                  step.voice_prompt || step.title,
                );
              } else {
                Tts.stop();
                setPaused(true);
                lastTickAtRef.current = null;
              }
            }}
          >
            <Text style={styles.secondaryButtonIcon}>
              {paused ? "▶" : "Ⅱ"}
            </Text>

            <Text style={styles.secondaryButtonText}>
              {paused ? "Resume" : "Pause"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.finishButton,
              (saving ||
                elapsed < SESSION_DURATION_SECONDS) &&
                styles.buttonDisabled,
            ]}
            disabled={
              saving ||
              elapsed < SESSION_DURATION_SECONDS
            }
            activeOpacity={0.85}
            onPress={() => void completeSession()}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.finishButtonText}>
                  {elapsed < SESSION_DURATION_SECONDS
                    ? "Complete at 05:00"
                    : "Finish session"}
                </Text>

                <Text style={styles.finishButtonArrow}>
                  →
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          A little time for yourself makes a difference.
        </Text>
      </LinearGradient>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  gradient: {
    flex: 1,
    paddingHorizontal: 22,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 16,
    color: COLORS.muted,
    fontSize: 14,
  },

  errorEmoji: {
    fontSize: 42,
    marginBottom: 16,
  },

  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },

  errorText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 12,
  },

  primaryButton: {
    marginTop: 26,
    paddingHorizontal: 32,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: COLORS.green,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#FFFFFFCC",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  backIcon: {
    fontSize: 30,
    lineHeight: 32,
    color: COLORS.forest,
    fontWeight: "300",
  },

  soundIcon: {
    fontSize: 23,
    color: COLORS.green,
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  headerEyebrow: {
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: "800",
    color: COLORS.muted,
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 4,
  },

  progressSection: {
    marginTop: 22,
  },

  progressTrack: {
    height: 5,
    backgroundColor: "#DDE9DE",
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: COLORS.green,
    borderRadius: 10,
  },

  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 9,
  },

  progressLabel: {
    color: COLORS.muted,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "800",
  },

  focusArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
    paddingVertical: 12,
  },

  focusEyebrow: {
    fontSize: 10,
    letterSpacing: 2.8,
    color: COLORS.green,
    fontWeight: "900",
    marginBottom: 16,
  },

  orbContainer: {
    width: 210,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },

  orbHalo: {
    position: "absolute",
    width: 202,
    height: 202,
    borderRadius: 110,
    backgroundColor: "#B8DCC0",
  },

  orbOuter: {
    width: 174,
    height: 174,
    borderRadius: 92,
    padding: 8,
    backgroundColor: "#FFFFFFAA",
    shadowColor: "#3D8051",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },

  orbGradient: {
    flex: 1,
    borderRadius: 84,
    alignItems: "center",
    justifyContent: "center",
  },

  orbInnerRing: {
    width: 120,
    height: 120,
    borderRadius: 64,
    borderWidth: 1,
    borderColor: "#FFFFFF80",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF12",
  },

  orbLeaf: {
    fontSize: 24,
    color: "#FFFFFF",
  },

  orbText: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  stepTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 22,
  },

  stepInstruction: {
    color: "#6F8074",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 9,
    maxWidth: 310,
  },

  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 15,
    paddingHorizontal: 17,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFFB8",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  timerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
  },

  timerText: {
    color: COLORS.forest,
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  sessionCountdownLabel: {
    marginTop: 13,
    color: COLORS.muted,
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: "800",
  },

  sessionCountdown: {
    marginTop: 3,
    color: COLORS.forest,
    fontSize: 25,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },

  guidanceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 20,
    backgroundColor: "#FFFFFFD9",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 15,
  },

  guidanceIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: COLORS.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },

  guidanceIconText: {
    fontSize: 22,
    color: COLORS.green,
  },

  guidanceContent: {
    flex: 1,
    marginLeft: 11,
    marginRight: 6,
  },

  guidanceTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  guidanceSubtitle: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#EAF5EC",
  },

  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#398653",
  },

  offlineText: {
    color: COLORS.green,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  controls: {
    flexDirection: "row",
    gap: 11,
  },

  secondaryButton: {
    minHeight: 54,
    minWidth: 112,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  secondaryButtonIcon: {
    fontSize: 15,
    color: COLORS.green,
    fontWeight: "800",
  },

  secondaryButtonText: {
    color: COLORS.forest,
    fontSize: 13,
    fontWeight: "800",
  },

  finishButton: {
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COLORS.green,
    shadowColor: COLORS.forest,
    shadowOpacity: 0.15,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  finishButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },

  finishButtonArrow: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "500",
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  footerText: {
    textAlign: "center",
    color: "#84958A",
    fontSize: 10,
    marginTop: 13,
  },
});