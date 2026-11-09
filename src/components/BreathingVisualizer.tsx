
 // src/components/BreathingVisualizer.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import {
  Wind,
  Heart,
  Sparkles,
} from "lucide-react-native";

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
  mint: "#C8E9D5",
  paleMint: "#E5F4EA",
  softGreen: "#A9D9BA",
  white: "#FFFFFF",
  muted: "#648071",
};

const PHASE_CONTENT: Record<
  Phase,
  { title: string; subtitle: string; symbol: string }
> = {
  "breathe-in": {
    title: "Breathe in",
    subtitle: "Slowly draw in a gentle breath",
    symbol: "↑",
  },
  hold: {
    title: "Hold",
    subtitle: "Stay relaxed and comfortable",
    symbol: "•",
  },
  "breathe-out": {
    title: "Breathe out",
    subtitle: "Release your breath gently",
    symbol: "↓",
  },
  focus: {
    title: "Stay present",
    subtitle: "Bring your attention to this moment",
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
  const outerScale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;
  const rotationPulse = useRef(new Animated.Value(0)).current;

  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const circleSize = Math.min(Math.max(width - 100, 240), 300);
  const coreSize = circleSize * 0.43;
  const outerSize = circleSize * 0.82;

  useEffect(() => {
    const ms = Math.max(500, durationSeconds * 1000);

    // Stop every previous animation before starting the next phase.
    animationRef.current?.stop();
    scale.stopAnimation();
    outerScale.stopAnimation();
    opacity.stopAnimation();
    rotationPulse.stopAnimation();

    const animate = (
      value: Animated.Value,
      toValue: number,
      duration: number,
      easing = Easing.inOut(Easing.ease),
    ) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing,
        useNativeDriver: true,
      });

    if (phase === "breathe-in") {
      scale.setValue(0.88);
      outerScale.setValue(0.9);
      opacity.setValue(0.55);

      animationRef.current = Animated.parallel([
        animate(scale, 1.12, ms),
        animate(outerScale, 1.08, ms),
        animate(opacity, 1, ms),
      ]);
    } else if (phase === "breathe-out") {
      scale.setValue(1.12);
      outerScale.setValue(1.08);
      opacity.setValue(1);

      animationRef.current = Animated.parallel([
        animate(scale, 0.88, ms),
        animate(outerScale, 0.9, ms),
        animate(opacity, 0.55, ms),
      ]);
    } else {
      // A gentle pulse during hold/focus.
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            animate(scale, 1.02, 1000),
            animate(outerScale, 1.04, 1000),
            animate(opacity, 0.85, 1000),
          ]),
          Animated.parallel([
            animate(scale, 0.98, 1000),
            animate(outerScale, 1, 1000),
            animate(opacity, 0.6, 1000),
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
      rotationPulse.stopAnimation();
    };
  }, [
    phase,
    durationSeconds,
    scale,
    outerScale,
    opacity,
    rotationPulse,
  ]);

  const content = PHASE_CONTENT[phase];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.visualArea,
          { width: circleSize + 20, height: circleSize + 20 },
        ]}
      >
        {/* Soft outer glow */}
        <Animated.View
          style={[
            styles.outerGlow,
            {
              width: outerSize,
              height: outerSize,
              borderRadius: outerSize / 2,
              opacity,
              transform: [{ scale: outerScale }],
            },
          ]}
        />

        {/* Middle ring */}
        <Animated.View
          style={[
            styles.middleRing,
            {
              width: circleSize * 0.68,
              height: circleSize * 0.68,
              borderRadius: circleSize * 0.34,
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
              width: circleSize * 0.56,
              height: circleSize * 0.56,
              borderRadius: circleSize * 0.28,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />

        {/* Inner circle and icon */}
        <Animated.View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          {phase === "focus" ? (
            <Sparkles size={34} color={COLORS.white} />
          ) : phase === "hold" ? (
            <Heart size={34} color={COLORS.white} />
          ) : (
            <Wind size={36} color={COLORS.white} />
          )}
        </Animated.View>
      </View>

      <View style={styles.instructionArea}>
        <Text style={styles.phaseTitle}>
          {label?.trim() || content.title}
        </Text>

        <Text style={styles.subtitle}>{content.subtitle}</Text>

        <View style={styles.durationPill}>
          <View style={styles.durationDot} />
          <Text style={styles.durationText}>
            {Math.max(0, Math.round(durationSeconds))} seconds
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: 12,
  },

  visualArea: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  outerGlow: {
    position: "absolute",
    backgroundColor: COLORS.paleMint,
    borderWidth: 1,
    borderColor: COLORS.softGreen,
  },

  middleRing: {
    position: "absolute",
    backgroundColor: COLORS.mint,
    borderWidth: 2,
    borderColor: COLORS.softGreen,
  },

  mainCircle: {
    position: "absolute",
    backgroundColor: COLORS.softGreen,
  },

  core: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.green,
    borderWidth: 4,
    borderColor: "#D9F0E1",
    shadowColor: COLORS.darkGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },

  instructionArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 8,
  },

  phaseTitle: {
    color: COLORS.darkGreen,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "center",
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },

  durationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 15,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.paleMint,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D6EBDD",
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
    letterSpacing: 0.4,
  },
});
