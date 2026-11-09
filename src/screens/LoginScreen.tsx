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
  const { width } = useWindowDimensions();

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

  // Decorative animations only. They never control form layout.
  const breathe = useRef(new Animated.Value(0)).current;
  const floatOne = useRef(new Animated.Value(0)).current;
  const floatTwo = useRef(new Animated.Value(0)).current;

  const compact = width < 380;
  const horizontalPadding = width < 360 ? 16 : 23;

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
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    );

    const float = (value: Animated.Value, duration: number, distance: number) =>
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

    const floatAnimationOne = float(floatOne, 3200, 5);
    const floatAnimationTwo = float(floatTwo, 3800, 4);

    breathing.start();
    floatAnimationOne.start();
    floatAnimationTwo.start();

    return () => {
      mountedRef.current = false;
      showSubscription.remove();
      hideSubscription.remove();
      breathing.stop();
      floatAnimationOne.stop();
      floatAnimationTwo.stop();
    };
  }, [breathe, floatOne, floatTwo]);

  const auraScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
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
      if (mountedRef.current) setLoading(false);
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
      if (mountedRef.current) setLoading(false);
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

    // Changing the form mode intentionally ends the current editing session.
    Keyboard.dismiss();
    setFocusedField(null);
    setShowPassword(false);
    setMode(nextMode);
  }

  function togglePasswordVisibility() {
    if (loading) return;

    const nextVisibility = !showPassword;
    setShowPassword(nextVisibility);

    // Re-focus after React applies the secureTextEntry change on Android.
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

      <LinearGradient
        pointerEvents="none"
        colors={["#F8FCF9", "#E7F5EB", "#F1F8F3"]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Non-interactive background decoration */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.ambientGlow,
            { transform: [{ scale: auraScale }] },
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
            colors={["rgba(114,224,157,0.42)", "rgba(114,224,157,0.02)"]}
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
            colors={["rgba(181,238,202,0.45)", "rgba(181,238,202,0.02)"]}
            style={styles.orbFill}
          />
        </Animated.View>

        <View style={styles.backgroundRing} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardLayer}
        // Android uses adjustResize in AndroidManifest.xml.
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: keyboardVisible
                ? 10
                : Math.max(insets.top + 10, 18),
              paddingBottom: Math.max(insets.bottom + 20, 24),
              paddingHorizontal: horizontalPadding,
            },
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          // Prevent Android from clipping/recycling focused inputs during resize.
          removeClippedSubviews={false}
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.content}>
            {/* Hide the large hero while the keyboard is open to avoid
                unnecessary scrolling and keep the inputs easy to reach. */}
            {!keyboardVisible && (
              <View style={[styles.hero, compact && styles.heroCompact]}>
                <View style={styles.brainStage}>
                  <Animated.View
                    style={[
                      styles.brainAura,
                      { transform: [{ scale: auraScale }] },
                    ]}
                  />

                  <View style={styles.orbitRing} />

                  <View style={styles.brainShadow}>
                    <LinearGradient
                      colors={["#74D99A", "#2C995C", "#155334"]}
                      start={{ x: 0.12, y: 0 }}
                      end={{ x: 0.88, y: 1 }}
                      style={styles.brainCore}
                    >
                      <View style={styles.brainShine} />
                      <Brain
                        size={compact ? 38 : 45}
                        color="#FFFFFF"
                        strokeWidth={1.65}
                      />
                      <View style={styles.brainLeaf}>
                        <Leaf size={14} color="#D8FFE4" strokeWidth={2} />
                      </View>
                    </LinearGradient>
                  </View>

                  <View style={[styles.floatBadge, styles.badgeTop]}>
                    <Sparkles size={16} color="#348B55" />
                  </View>

                  <View style={[styles.floatBadge, styles.badgeSide]}>
                    <Leaf size={16} color="#4A9D69" />
                  </View>
                </View>

                <Text style={styles.brandName}>
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

            <View style={styles.cardOuter}>
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0.99)",
                  "rgba(255,255,255,0.96)",
                  "rgba(240,250,243,0.98)",
                ]}
                style={styles.card}
              >
                <View style={styles.cardHeading}>
                  <View style={styles.headingIcon}>
                    {mode === "login" ? (
                      <ShieldCheck size={21} color={C.green} />
                    ) : (
                      <Sparkles size={21} color={C.green} />
                    )}
                  </View>

                  <View style={styles.headingCopy}>
                    <Text style={styles.cardTitle}>
                      {mode === "login" ? "Welcome back" : "Begin your journey"}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {mode === "login"
                        ? "Take a breath. You're in the right place."
                        : "A little space for a healthier you."}
                    </Text>
                  </View>
                </View>

                <View style={styles.modeSwitch}>
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
                          active && styles.modeOptionActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.modeText,
                            active && styles.modeTextActive,
                          ]}
                        >
                          {item === "login" ? "Sign in" : "Create account"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>

                <View
                  style={[
                    styles.inputShell,
                    focusedField === "email" && styles.inputFocused,
                  ]}
                >
                  <View pointerEvents="none" style={styles.inputIcon}>
                    <Mail
                      size={18}
                      color={focusedField === "email" ? C.green : "#8AA092"}
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
                    focusedField === "password" && styles.inputFocused,
                  ]}
                >
                  <View pointerEvents="none" style={styles.inputIcon}>
                    <LockKeyhole
                      size={18}
                      color={
                        focusedField === "password" ? C.green : "#8AA092"
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
                      mode === "signup" ? "Create a password" : "Your password"
                    }
                    placeholderTextColor="#9AAEA0"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={
                      mode === "signup" ? "newPassword" : "password"
                    }
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
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
                      showPassword ? "Hide password" : "Show password"
                    }
                    accessibilityState={{ selected: showPassword }}
                  >
                    {showPassword ? (
                      <EyeOff size={19} color="#789383" />
                    ) : (
                      <Eye size={19} color="#789383" />
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={submit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={
                    mode === "login" ? "Sign in" : "Create account"
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
                    style={styles.actionGradient}
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
                          <ArrowRight size={18} color="#FFFFFF" />
                        </View>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <View style={styles.secureNote}>
                  <ShieldCheck size={14} color="#639475" />
                  <Text style={styles.secureText}>
                    Your wellness space, protected.
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {!keyboardVisible && (
              <>
                <View style={styles.footer}>
                  <View style={styles.footerIcon}>
                    <Check size={14} color="#4D9366" />
                  </View>
                  <Text style={styles.footerText}>
                    Small steps. Softer days. A healthier you.
                  </Text>
                </View>

                <Text style={styles.legalText}>
                  By continuing, you agree to our Terms &amp; Privacy Policy.
                </Text>
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
  },
  content: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },

  ambientGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    top: 8,
    alignSelf: "center",
    borderRadius: 150,
    backgroundColor: "rgba(112,226,155,0.18)",
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

  hero: {
    alignItems: "center",
    marginBottom: 22,
  },
  heroCompact: {
    marginBottom: 15,
  },
  brainStage: {
    width: 132,
    height: 126,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  brainAura: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(72,193,116,0.20)",
  },
  orbitRing: {
    position: "absolute",
    width: 115,
    height: 115,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: "rgba(63,157,91,0.26)",
    borderStyle: "dashed",
  },
  brainShadow: {
    width: 78,
    height: 78,
    borderRadius: 28,
    elevation: 8,
  },
  brainCore: {
    flex: 1,
    borderRadius: 28,
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
    right: 11,
    bottom: 10,
  },
  floatBadge: {
    position: "absolute",
    width: 31,
    height: 31,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(65,147,89,0.14)",
    elevation: 3,
  },
  badgeTop: {
    top: 10,
    right: 8,
  },
  badgeSide: {
    left: 9,
    bottom: 9,
  },
  brandName: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.4,
    color: C.deep,
  },
  brandAccent: {
    color: C.green,
    fontWeight: "500",
  },
  brandSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#718B79",
    textAlign: "center",
  },
  wellnessPill: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(54,137,82,0.13)",
    backgroundColor: "rgba(255,255,255,0.64)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#50B875",
  },
  wellnessPillText: {
    color: "#568166",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },

  cardOuter: {
    borderRadius: 29,
    padding: 1,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.98)",
    shadowColor: "#397D51",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 21,
    paddingTop: 21,
    paddingBottom: 18,
    overflow: "hidden",
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },
  headingIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#E5F5EA",
    borderWidth: 1,
    borderColor: "#D4EBDD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headingCopy: {
    flex: 1,
  },
  cardTitle: {
    color: C.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  cardSubtitle: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(226,239,229,0.85)",
    padding: 4,
    borderRadius: 14,
    marginBottom: 20,
  },
  modeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 11,
  },
  modeOptionActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(40,122,74,0.1)",
    elevation: 1,
  },
  modeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#829687",
  },
  modeTextActive: {
    color: C.green,
    fontWeight: "800",
  },
  fieldLabel: {
    color: "#678571",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 1,
  },
  passwordHint: {
    fontSize: 10,
    color: "#91A596",
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    marginBottom: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(43,117,68,0.13)",
    backgroundColor: "rgba(248,252,249,0.97)",
  },
  inputFocused: {
    borderColor: "#69B783",
    backgroundColor: "#FFFFFF",
  },
  inputIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#EDF5EF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontSize: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 9,
    includeFontPadding: false,
  },
  passwordToggle: {
    width: 42,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  actionWrap: {
    marginTop: 2,
    borderRadius: 17,
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
    minHeight: 55,
    borderRadius: 17,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.23)",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  actionArrow: {
    position: "absolute",
    right: 9,
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.17)",
  },
  secureNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  secureText: {
    color: "#7B9582",
    fontSize: 11,
    fontWeight: "500",
  },
  footer: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  footerIcon: {
    width: 24,
    height: 24,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 11,
    color: "#72907B",
    fontWeight: "500",
  },
  legalText: {
    marginTop: 8,
    textAlign: "center",
    color: "#9AAF9F",
    fontSize: 10,
    lineHeight: 15,
  },
});
