
 // src/components/BreathingVisualizer.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
  AccessibilityInfo,
} from "react-native";
import { Wind, Heart, Sparkles } from "lucide-react-native";

type Phase = "breathe-in" | "hold" | "breathe-out" | "focus";

type Props = {
  phase: Phase;
  durationSeconds: number;
  label?: string;
};

const COLORS = {
  background: "#F4F8F5",
  green: "#247A4A",
  darkGreen: "#155333",
  deepGreen: "#103F2A",
  mint: "#C8E9D5",
  paleMint: "#E5F4EA",
  softGreen: "#A9D9BA",
  white: "#FFFFFF",
  muted: "#648071",
  border: "#D6EBDD",
  track: "#DCEBE1",
};

const PHASE_CONTENT: Record<
  Phase,
  { title: string; subtitle: string; symbol: string }
> = {
  "breathe-in": {
    title: "Breathe in",
    subtitle: "Gently draw air in through your nose",
    symbol: "↑",
  },
  hold: {
    title: "Hold gently",
    subtitle: "Stay comfortable. Never force your breath",
    symbol: "•",
  },
  "breathe-out": {
    title: "Breathe out",
    subtitle: "Slowly release the breath and relax",
    symbol: "↓",
  },
  focus: {
    title: "Be present",
    subtitle: "Let your attention rest in this moment",
    symbol: "✦",
  },
};

export default function BreathingVisualizer({
  phase,
  durationSeconds,
  label,
}: Props) {
  const { width } = useWindowDimensions();

  const scale = useRef(new Animated.Value(0.88)).current;
  const outerScale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;
  const haloOpacity = useRef(new Animated.Value(0.35)).current;

  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const reduceMotionRef = useRef(false);

  const circleSize = Math.min(Math.max(width - 88, 220), 292);
  const outerSize = circleSize * 0.94;
  const middleSize = circleSize * 0.76;
  const mainSize = circleSize * 0.59;
  const coreSize = circleSize * 0.41;

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) reduceMotionRef.current = enabled;
      })
      .catch(() => {
        reduceMotionRef.current = false;
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        reduceMotionRef.current = enabled;
      },
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    animationRef.current?.stop();

    scale.stopAnimation();
    outerScale.stopAnimation();
    opacity.stopAnimation();
    haloOpacity.stopAnimation();

    const ms = Math.max(700, durationSeconds * 1000);

    const animate = (
      value: Animated.Value,
      toValue: number,
      duration: number,
    ) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });

    if (reduceMotionRef.current) {
      const targetScale =
        phase === "breathe-in" ? 1.04 :
        phase === "breathe-out" ? 0.96 : 1;

      scale.setValue(targetScale);
      outerScale.setValue(1);
      opacity.setValue(0.85);
      haloOpacity.setValue(0.35);

      return () => {
        animationRef.current?.stop();
      };
    }

    if (phase === "breathe-in") {
      scale.setValue(0.88);
      outerScale.setValue(0.92);
      opacity.setValue(0.68);
      haloOpacity.setValue(0.25);

      animationRef.current = Animated.parallel([
        animate(scale, 1.08, ms),
        animate(outerScale, 1.04, ms),
        animate(opacity, 1, ms),
        animate(haloOpacity, 0.65, ms),
      ]);
    } else if (phase === "breathe-out") {
      scale.setValue(1.08);
      outerScale.setValue(1.04);
      opacity.setValue(1);
      haloOpacity.setValue(0.65);

      animationRef.current = Animated.parallel([
        animate(scale, 0.88, ms),
        animate(outerScale, 0.92, ms),
        animate(opacity, 0.68, ms),
        animate(haloOpacity, 0.25, ms),
      ]);
    } else {
      // A subtle, slow pulse for holding or mindful focus.
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            animate(scale, 1.015, 1800),
            animate(outerScale, 1.015, 1800),
            animate(haloOpacity, 0.48, 1800),
          ]),
          Animated.parallel([
            animate(scale, 0.985, 1800),
            animate(outerScale, 0.99, 1800),
            animate(haloOpacity, 0.28, 1800),
          ]),
        ]),
      );
    }

    animationRef.current.start();

    return () => {
      animationRef.current?.stop();
      scale.stopAnimation();
      outerScale.stopAnimation();
      opacity.stopAnimation();
      haloOpacity.stopAnimation();
    };
  }, [
    phase,
    durationSeconds,
    scale,
    outerScale,
    opacity,
    haloOpacity,
  ]);

  const content = PHASE_CONTENT[phase];
  const phaseTitle = label?.trim() || content.title;
  const seconds = Math.max(0, Math.round(durationSeconds));

  const Icon =
    phase === "focus" ? Sparkles : phase === "hold" ? Heart : Wind;

  return (
    <View style={styles.container}>
      <View style={styles.eyebrow}>
        <View style={styles.eyebrowDot} />
        <Text style={styles.eyebrowText}>MINDFUL BREATHING</Text>
      </View>

      <View
        style={[
          styles.visualArea,
          { width: circleSize + 24, height: circleSize + 24 },
        ]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${phaseTitle}. ${content.subtitle}. ${seconds} seconds remaining.`}
      >
        {/* Outer atmosphere */}
        <Animated.View
          style={[
            styles.outerGlow,
            {
              width: outerSize,
              height: outerSize,
              borderRadius: outerSize / 2,
              opacity: haloOpacity,
              transform: [{ scale: outerScale }],
            },
          ]}
        />

        {/* Decorative outer ring */}
        <Animated.View
          style={[
            styles.outerRing,
            {
              width: outerSize * 0.91,
              height: outerSize * 0.91,
              borderRadius: (outerSize * 0.91) / 2,
              transform: [{ scale: outerScale }],
            },
          ]}
        />

        {/* Middle ring */}
        <Animated.View
          style={[
            styles.middleRing,
            {
              width: middleSize,
              height: middleSize,
              borderRadius: middleSize / 2,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />

        {/* Main breathing circle */}
        <Animated.View
          style={[
            styles.mainCircle,
            {
              width: mainSize,
              height: mainSize,
              borderRadius: mainSize / 2,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />

        {/* Inner focus orb */}
        <Animated.View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={styles.iconHalo}>
            <Icon
              size={Math.min(36, coreSize * 0.39)}
              color={COLORS.white}
              strokeWidth={1.7}
            />
          </View>
          <Text style={styles.orbCaption}>
            {phase === "breathe-in"
              ? "INHALE"
              : phase === "breathe-out"
              ? "EXHALE"
              : phase === "hold"
              ? "PAUSE"
              : "FOCUS"}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.instructionArea}>
        <Text style={styles.phaseTitle}>{phaseTitle}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>

        <View style={styles.durationPill}>
          <View style={styles.durationDot} />
          <Text style={styles.durationText}>
            {seconds} {seconds === 1 ? "second" : "seconds"} remaining
          </Text>
        </View>

        <Text style={styles.helperText}>
          Follow the rhythm. There is no need to rush.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 18,
  },

  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 30,
    backgroundColor: "#EAF5ED",
  },

  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.green,
    marginRight: 8,
  },

  eyebrowText: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },

  visualArea: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 8,
  },

  outerGlow: {
    position: "absolute",
    backgroundColor: "#D5EFDE",
  },

  outerRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#C3E4CE",
    backgroundColor: "rgba(255,255,255,0.13)",
  },

  middleRing: {
    position: "absolute",
    backgroundColor: "#D7EEDF",
    borderWidth: 1,
    borderColor: "#C3E4CE",
  },

  mainCircle: {
    position: "absolute",
    backgroundColor: "#B5DFC2",
    borderWidth: 1,
    borderColor: "#A5D5B5",
  },

  core: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.green,
    borderWidth: 4,
    borderColor: "#DDF1E3",
    shadowColor: COLORS.deepGreen,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 8,
  },

  iconHalo: {
    alignItems: "center",
    justifyContent: "center",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.13)",
  },

  orbCaption: {
    color: "#F2FFF5",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 5,
  },

  instructionArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 4,
    width: "100%",
  },

  phaseTitle: {
    color: COLORS.darkGreen,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },

  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.darkGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  durationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },

  durationText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  helperText: {
    color: "#82968A",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 12,
  },
});
