// src/components/BreathingVisualizer.tsx
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";

type Phase = "breathe-in" | "hold" | "breathe-out" | "focus";

type Props = {
  phase: Phase;
  durationSeconds: number;
  label?: string;
};

export default function BreathingVisualizer({ phase, durationSeconds, label }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const ms = Math.max(500, durationSeconds * 1000);
    scale.stopAnimation();
    opacity.stopAnimation();

    if (phase === "breathe-in") {
      Animated.timing(scale, {
        toValue: 1.6,
        duration: ms,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
      Animated.timing(opacity, { toValue: 1, duration: ms, useNativeDriver: true }).start();
    } else if (phase === "breathe-out") {
      Animated.timing(scale, {
        toValue: 0.9,
        duration: ms,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
      Animated.timing(opacity, { toValue: 0.5, duration: ms, useNativeDriver: true }).start();
    } else {
      // hold / focus — gentle pulse in place
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.9, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [phase, durationSeconds]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          { transform: [{ scale }], opacity },
        ]}
      />
      <Animated.View style={[styles.core, { opacity }]} />
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", height: 320 },
  ring: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#C8E9D5",
  },
  core: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#247A4A",
  },
  label: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: "700",
    color: "#247A4A",
    letterSpacing: 1,
  },
});