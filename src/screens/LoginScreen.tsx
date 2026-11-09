
// src/screens/LoginScreen.tsx

import React, { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import LinearGradient from "react-native-linear-gradient";

import {
  ArrowRight,
  Brain,
  Check,
  Code2,
  Eye,
  EyeOff,
  Leaf,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type LoginScreenProps = {
  onLogin: (session: any) => void;
};

type AuthMode = "login" | "signup";
type FocusedField = "email" | "password" | null;

const C = {
  bg: "#F0F8F2",
  green: "#247A4A",
  deep: "#123F2B",
  text: "#183C2B",
  muted: "#7C9483",
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  // Decorative animations
  const breathe = useRef(new Animated.Value(0)).current;
  const floatOne = useRef(new Animated.Value(0)).current;
  const floatTwo = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.45)).current;

  const compactWidth = width < 380;
  const shortScreen = height < 760;
  const compact = compactWidth || shortScreen;

  const horizontalPadding = width < 360 ? 16 : 22;

  useEffect(() => {
    mountedRef.current = true;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2800,
          useNativeDriver: true,
        }),
      ]),
    );

    const float = (
      value: Animated.Value,
      duration: number,
      distance: number,
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: distance,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: -distance,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ]),
      );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.8,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.35,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    );

    const floatAnimationOne = float(floatOne, 3600, 6);
    const floatAnimationTwo = float(floatTwo, 4200, 5);

    breathing.start();
    floatAnimationOne.start();
    floatAnimationTwo.start();
    glow.start();

    return () => {
      mountedRef.current = false;

      showSubscription.remove();
      hideSubscription.remove();

      breathing.stop();
      floatAnimationOne.stop();
      floatAnimationTwo.stop();
      glow.stop();
    };
  }, [breathe, floatOne, floatTwo, glowOpacity]);

  const auraScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.07],
  });

  const secondaryAuraScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1.06, 0.94],
  });

  async function login() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert("Missing details", "Enter your email and password.");
      return;
    }

    if (submittingRef.current) return;

    submittingRef.current = true;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!mountedRef.current) return;

      if (error) {
        Alert.alert("Login unsuccessful", error.message);
        return;
      }

      if (data.session) {
        onLogin(data.session);
      } else {
        Alert.alert(
          "Unable to sign in",
          "No active session was returned. Please try again.",
        );
      }
    } catch (error) {
      if (mountedRef.current) {
        Alert.alert(
          "Login error",
          error instanceof Error ? error.message : "Please try again.",
        );
      }
    } finally {
      submittingRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  async function signup() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert("Missing details", "Enter your email and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Password too short",
        "Use at least 6 characters for your password.",
      );
      return;
    }

    if (submittingRef.current) return;

    submittingRef.current = true;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (!mountedRef.current) return;

      if (error) {
        Alert.alert("Signup unsuccessful", error.message);
        return;
      }

      if (data.session) {
        onLogin(data.session);
      } else {
        Alert.alert(
          "Check your email",
          "Your account has been created. Verify your email, then return to sign in.",
        );

        setMode("login");
        setPassword("");
        setShowPassword(false);
        setFocusedField(null);
      }
    } catch (error) {
      if (mountedRef.current) {
        Alert.alert(
          "Signup error",
          error instanceof Error ? error.message : "Please try again.",
        );
      }
    } finally {
      submittingRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  function submit() {
    if (submittingRef.current || loading) return;

    Keyboard.dismiss();

    if (mode === "login") {
      void login();
    } else {
      void signup();
    }
  }

  function changeMode(nextMode: AuthMode) {
    if (loading || mode === nextMode) return;

    Keyboard.dismiss();

    setFocusedField(null);
    setShowPassword(false);
    setMode(nextMode);
  }

  function togglePasswordVisibility() {
    if (loading) return;

    const nextVisibility = !showPassword;
    setShowPassword(nextVisibility);

    requestAnimationFrame(() => {
      passwordRef.current?.focus();
    });
  }

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={C.bg}
        translucent={false}
      />

      {/* Main background */}
      <LinearGradient
        pointerEvents="none"
        colors={["#F9FCF9", "#E9F7ED", "#EFF8F1"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Modern animated aura background */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.ambientGlow,
            {
              opacity: glowOpacity,
              transform: [{ scale: auraScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.secondaryGlow,
            {
              opacity: glowOpacity,
              transform: [{ scale: secondaryAuraScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.orb,
            styles.orbTop,
            { transform: [{ translateY: floatOne }] },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(91,211,137,0.32)",
              "rgba(91,211,137,0.01)",
            ]}
            style={styles.orbFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.orb,
            styles.orbLeft,
            { transform: [{ translateY: floatTwo }] },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(153,228,178,0.38)",
              "rgba(153,228,178,0.01)",
            ]}
            style={styles.orbFill}
          />
        </Animated.View>

        <View style={styles.backgroundRing} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardLayer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: keyboardVisible
                ? 6
                : Math.max(insets.top + (shortScreen ? 3 : 7), 10),

              paddingBottom: Math.max(insets.bottom + 10, 12),
              paddingHorizontal: horizontalPadding,
            },
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.content}>
            {/* Compact hero branding */}
            {!keyboardVisible && (
              <View
                style={[
                  styles.hero,
                  compact && styles.heroCompact,
                ]}
              >
                <View
                  style={[
                    styles.brainStage,
                    compact && styles.brainStageCompact,
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.brainAura,
                      { transform: [{ scale: auraScale }] },
                    ]}
                  />

                  <View style={styles.orbitRing} />

                  <View
                    style={[
                      styles.brainShadow,
                      compact && styles.brainShadowCompact,
                    ]}
                  >
                    <LinearGradient
                      colors={["#74D99A", "#2C995C", "#155334"]}
                      start={{ x: 0.12, y: 0 }}
                      end={{ x: 0.88, y: 1 }}
                      style={styles.brainCore}
                    >
                      <View style={styles.brainShine} />

                      <Brain
                        size={compact ? 34 : 39}
                        color="#FFFFFF"
                        strokeWidth={1.65}
                      />

                      <View style={styles.brainLeaf}>
                        <Leaf
                          size={13}
                          color="#D8FFE4"
                          strokeWidth={2}
                        />
                      </View>
                    </LinearGradient>
                  </View>

                  <View style={[styles.floatBadge, styles.badgeTop]}>
                    <Sparkles size={14} color="#348B55" />
                  </View>

                  <View style={[styles.floatBadge, styles.badgeSide]}>
                    <Leaf size={14} color="#4A9D69" />
                  </View>
                </View>

                <Text
                  style={[
                    styles.brandName,
                    compact && styles.brandNameCompact,
                  ]}
                >
                  Wellness<Text style={styles.brandAccent}> AI</Text>
                </Text>

                <Text style={styles.brandSubtitle}>
                  Find your calm. Grow at your pace.
                </Text>

                <View style={styles.wellnessPill}>
                  <View style={styles.liveDot} />

                  <Text style={styles.wellnessPillText}>
                    YOUR PERSONAL WELLNESS SPACE
                  </Text>
                </View>
              </View>
            )}

            {/* Authentication card */}
            <View style={styles.cardOuter}>
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.99)",
                  "rgba(255,255,255,0.96)",
                  "rgba(240,250,243,0.98)",
                ]}
                style={[
                  styles.card,
                  compact && styles.cardCompact,
                ]}
              >
                <View
                  style={[
                    styles.cardHeading,
                    compact && styles.cardHeadingCompact,
                  ]}
                >
                  <View
                    style={[
                      styles.headingIcon,
                      compact && styles.headingIconCompact,
                    ]}
                  >
                    {mode === "login" ? (
                      <ShieldCheck size={19} color={C.green} />
                    ) : (
                      <Sparkles size={19} color={C.green} />
                    )}
                  </View>

                  <View style={styles.headingCopy}>
                    <Text style={styles.cardTitle}>
                      {mode === "login"
                        ? "Welcome back"
                        : "Begin your journey"}
                    </Text>

                    <Text style={styles.cardSubtitle}>
                      {mode === "login"
                        ? "Take a breath. You're in the right place."
                        : "A little space for a healthier you."}
                    </Text>
                  </View>
                </View>

                {/* Login / Signup switch */}
                <View
                  style={[
                    styles.modeSwitch,
                    compact && styles.modeSwitchCompact,
                  ]}
                >
                  {(["login", "signup"] as AuthMode[]).map((item) => {
                    const active = mode === item;

                    return (
                      <Pressable
                        key={item}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        disabled={loading}
                        onPress={() => changeMode(item)}
                        style={[
                          styles.modeOption,
                          compact && styles.modeOptionCompact,
                          active && styles.modeOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modeText,
                            active && styles.modeTextActive,
                          ]}
                        >
                          {item === "login"
                            ? "Sign in"
                            : "Create account"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Email */}
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>

                <View
                  style={[
                    styles.inputShell,
                    compact && styles.inputShellCompact,
                    focusedField === "email" && styles.inputFocused,
                  ]}
                >
                  <View pointerEvents="none" style={styles.inputIcon}>
                    <Mail
                      size={17}
                      color={
                        focusedField === "email"
                          ? C.green
                          : "#8AA092"
                      }
                    />
                  </View>

                  <TextInput
                    ref={emailRef}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() =>
                      setFocusedField((field) =>
                        field === "email" ? null : field,
                      )
                    }
                    placeholder="you@example.com"
                    placeholderTextColor="#9AAEA0"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    editable={!loading}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    accessibilityLabel="Email address"
                    underlineColorAndroid="transparent"
                  />
                </View>

                {/* Password */}
                <View style={styles.passwordLabelRow}>
                  <Text style={styles.fieldLabel}>PASSWORD</Text>

                  {mode === "signup" && (
                    <Text style={styles.passwordHint}>
                      At least 6 characters
                    </Text>
                  )}
                </View>

                <View
                  style={[
                    styles.inputShell,
                    compact && styles.inputShellCompact,
                    focusedField === "password" && styles.inputFocused,
                  ]}
                >
                  <View pointerEvents="none" style={styles.inputIcon}>
                    <LockKeyhole
                      size={17}
                      color={
                        focusedField === "password"
                          ? C.green
                          : "#8AA092"
                      }
                    />
                  </View>

                  <TextInput
                    ref={passwordRef}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() =>
                      setFocusedField((field) =>
                        field === "password" ? null : field,
                      )
                    }
                    placeholder={
                      mode === "signup"
                        ? "Create a password"
                        : "Your password"
                    }
                    placeholderTextColor="#9AAEA0"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={
                      mode === "signup"
                        ? "newPassword"
                        : "password"
                    }
                    autoComplete={
                      mode === "signup"
                        ? "new-password"
                        : "current-password"
                    }
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                    accessibilityLabel="Password"
                    underlineColorAndroid="transparent"
                  />

                  <Pressable
                    onPress={togglePasswordVisibility}
                    disabled={loading}
                    hitSlop={8}
                    style={styles.passwordToggle}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    accessibilityState={{ selected: showPassword }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#789383" />
                    ) : (
                      <Eye size={18} color="#789383" />
                    )}
                  </Pressable>
                </View>

                {/* Submit */}
                <Pressable
                  onPress={submit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={
                    mode === "login"
                      ? "Sign in"
                      : "Create account"
                  }
                  style={({ pressed }) => [
                    styles.actionWrap,
                    pressed && !loading && styles.actionPressed,
                    loading && styles.actionDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={
                      loading
                        ? ["#78B58A", "#4A9061"]
                        : ["#3BA568", "#247A4A", "#164D31"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.actionGradient,
                      compact && styles.actionGradientCompact,
                    ]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.actionText}>
                          {mode === "login"
                            ? "Enter your space"
                            : "Create my account"}
                        </Text>

                        <View style={styles.actionArrow}>
                          <ArrowRight size={17} color="#FFFFFF" />
                        </View>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                {/* Security note */}
                <View style={styles.secureNote}>
                  <ShieldCheck size={13} color="#639475" />

                  <Text style={styles.secureText}>
                    Your wellness space, protected.
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Footer and developer watermark */}
            {!keyboardVisible && (
              <>
                <View style={styles.footer}>
                  <View style={styles.footerIcon}>
                    <Check size={13} color="#4D9366" />
                  </View>

                  <Text style={styles.footerText}>
                    Small steps. Softer days. A healthier you.
                  </Text>
                </View>

                {!shortScreen && (
                  <>
                    <Text style={styles.legalText}>
                      By continuing, you agree to our Terms &amp; Privacy Policy.
                    </Text>

                    <View style={styles.developerWatermark}>
                      <View style={styles.watermarkDivider}>
                        <View style={styles.watermarkLine} />
                        <View style={styles.watermarkDiamond} />
                        <View style={styles.watermarkLine} />
                      </View>

                      <View style={styles.developerSignature}>
                        <View style={styles.developerIcon}>
                          <Code2
                            size={13}
                            color="#39875A"
                            strokeWidth={2.2}
                          />
                        </View>

                        <View style={styles.developerCopy}>
                          <Text style={styles.developerLabel}>
                            DEVELOPED & ENGINEERED BY
                          </Text>

                          <Text style={styles.developerName}>
                            Aashish Kadoo
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.developerTagline}>
                        CRAFTED WITH PURPOSE · BUILT WITH PASSION
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },

  keyboardLayer: {
    flex: 1,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  content: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },

  // Animated aura background
  ambientGlow: {
    position: "absolute",
    width: 310,
    height: 310,
    top: 35,
    alignSelf: "center",
    borderRadius: 155,
    backgroundColor: "rgba(94,218,139,0.17)",
  },

  secondaryGlow: {
    position: "absolute",
    width: 250,
    height: 250,
    top: "38%",
    alignSelf: "center",
    borderRadius: 125,
    backgroundColor: "rgba(116,214,151,0.10)",
  },

  orb: {
    position: "absolute",
    borderRadius: 999,
    overflow: "hidden",
  },

  orbFill: {
    flex: 1,
    borderRadius: 999,
  },

  orbTop: {
    width: 150,
    height: 150,
    right: -60,
    top: 100,
  },

  orbLeft: {
    width: 130,
    height: 130,
    left: -65,
    top: "36%",
  },

  backgroundRing: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: "rgba(66,159,94,0.07)",
    top: -140,
    left: -105,
  },

  // Hero branding
  hero: {
    alignItems: "center",
    marginBottom: 15,
  },

  heroCompact: {
    marginBottom: 9,
  },

  brainStage: {
    width: 118,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },

  brainStageCompact: {
    width: 100,
    height: 88,
  },

  brainAura: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(72,193,116,0.20)",
  },

  orbitRing: {
    position: "absolute",
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 1,
    borderColor: "rgba(63,157,91,0.26)",
    borderStyle: "dashed",
  },

  brainShadow: {
    width: 70,
    height: 70,
    borderRadius: 25,
    elevation: 8,
  },

  brainShadowCompact: {
    width: 62,
    height: 62,
    borderRadius: 22,
  },

  brainCore: {
    flex: 1,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },

  brainShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "42%",
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  brainLeaf: {
    position: "absolute",
    right: 9,
    bottom: 8,
  },

  floatBadge: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(65,147,89,0.14)",
    elevation: 3,
  },

  badgeTop: {
    top: 7,
    right: 5,
  },

  badgeSide: {
    left: 5,
    bottom: 5,
  },

  brandName: {
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -1.3,
    color: C.deep,
  },

  brandNameCompact: {
    fontSize: 28,
  },

  brandAccent: {
    color: C.green,
    fontWeight: "500",
  },

  brandSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: "#718B79",
    textAlign: "center",
  },

  wellnessPill: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(54,137,82,0.13)",
    backgroundColor: "rgba(255,255,255,0.72)",
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50B875",
  },

  wellnessPillText: {
    color: "#568166",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.9,
  },

  // Authentication card
  cardOuter: {
    borderRadius: 27,
    padding: 1,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.98)",
    shadowColor: "#397D51",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },

  card: {
    borderRadius: 26,
    paddingHorizontal: 19,
    paddingTop: 17,
    paddingBottom: 14,
    overflow: "hidden",
  },

  cardCompact: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },

  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  cardHeadingCompact: {
    marginBottom: 10,
  },

  headingIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E5F5EA",
    borderWidth: 1,
    borderColor: "#D4EBDD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  headingIconCompact: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },

  headingCopy: {
    flex: 1,
  },

  cardTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  cardSubtitle: {
    color: C.muted,
    fontSize: 10,
    marginTop: 3,
    lineHeight: 14,
  },

  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(226,239,229,0.85)",
    padding: 3,
    borderRadius: 13,
    marginBottom: 15,
  },

  modeSwitchCompact: {
    marginBottom: 12,
  },

  modeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
  },

  modeOptionCompact: {
    paddingVertical: 8,
  },

  modeOptionActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(40,122,74,0.1)",
    elevation: 1,
  },

  modeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#829687",
  },

  modeTextActive: {
    color: C.green,
    fontWeight: "800",
  },

  fieldLabel: {
    color: "#678571",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginBottom: 6,
  },

  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0,
  },

  passwordHint: {
    fontSize: 9,
    color: "#91A596",
    marginBottom: 6,
  },

  inputShell: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(43,117,68,0.13)",
    backgroundColor: "rgba(248,252,249,0.97)",
  },

  inputShellCompact: {
    minHeight: 45,
    marginBottom: 10,
  },

  inputFocused: {
    borderColor: "#69B783",
    backgroundColor: "#FFFFFF",
  },

  inputIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: "#EDF5EF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  input: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 13,
    paddingVertical: Platform.OS === "ios" ? 12 : 7,
    includeFontPadding: false,
  },

  passwordToggle: {
    width: 38,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },

  actionWrap: {
    marginTop: 1,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
  },

  actionPressed: {
    opacity: 0.9,
  },

  actionDisabled: {
    opacity: 0.8,
  },

  actionGradient: {
    minHeight: 51,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.23)",
  },

  actionGradientCompact: {
    minHeight: 47,
  },

  actionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.1,
  },

  actionArrow: {
    position: "absolute",
    right: 8,
    width: 33,
    height: 33,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.17)",
  },

  secureNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 11,
  },

  secureText: {
    color: "#7B9582",
    fontSize: 10,
    fontWeight: "500",
  },

  // Footer
  footer: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  footerIcon: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },

  footerText: {
    fontSize: 10,
    color: "#72907B",
    fontWeight: "500",
  },

  legalText: {
    marginTop: 6,
    textAlign: "center",
    color: "#9AAF9F",
    fontSize: 9,
    lineHeight: 13,
  },

  // Developer watermark
  developerWatermark: {
    alignItems: "center",
    marginTop: 15,
    marginBottom: 2,
    paddingHorizontal: 12,
  },

  watermarkDivider: {
    width: "62%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 11,
  },

  watermarkLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(57,135,90,0.16)",
  },

  watermarkDiamond: {
    width: 5,
    height: 5,
    borderRadius: 2,
    backgroundColor: "#64A77A",
    transform: [{ rotate: "45deg" }],
  },

  developerSignature: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  developerIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "rgba(222,242,228,0.85)",
    borderWidth: 1,
    borderColor: "rgba(57,135,90,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  developerCopy: {
    alignItems: "flex-start",
  },

  developerLabel: {
    color: "#8AA392",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  developerName: {
    color: "#286B43",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 2,
  },

  developerTagline: {
    marginTop: 7,
    color: "#A0B3A5",
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1.1,
    textAlign: "center",
  },
});
