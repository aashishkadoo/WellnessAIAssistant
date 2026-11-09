// App.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  initializeDatabase,
  inspectDatabaseSchema,
} from "./src/database/database";

import { supabase } from "./src/lib/supabase";

import LoginScreen from "./src/screens/LoginScreen";
import WellnessHome from "./src/screens/WellnessHome";
import ExerciseScreen from "./src/screens/ExerciseScreen";
import ProgressScreen from "./src/screens/ProgressScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

import BottomNavigation from "./src/components/BottomNavigation";
import FloatingChatbot from "./src/components/FloatingChatbot";

// ============================================================================
// TYPES
// ============================================================================

export type ScreenKey =
  | "home"
  | "exercise"
  | "progress"
  | "profile";

type AuthStatus =
  | "initializing"
  | "authenticated"
  | "unauthenticated";

type VisitedScreens = Record<ScreenKey, boolean>;

type AppSession = Awaited<
  ReturnType<typeof supabase.auth.getSession>
>["data"]["session"];

type ScreenProps = {
  user: NonNullable<AppSession>["user"];
};

// ============================================================================
// CONSTANTS
// ============================================================================

export const TAB_BAR_HEIGHT = 72;

const CHATBOT_GAP = 24;

const INITIAL_VISITED_SCREENS: VisitedScreens = {
  home: true,
  exercise: false,
  progress: false,
  profile: false,
};

// ============================================================================
// MEMOIZED SCREENS
// ============================================================================

// React.memo prevents a screen from re-rendering when its props have not
// changed. This is particularly useful when another screen becomes active.

const MemoWellnessHome = memo(WellnessHome);
const MemoExerciseScreen = memo(ExerciseScreen);
const MemoProgressScreen = memo(ProgressScreen);
const MemoProfileScreen = memo(ProfileScreen);

// ============================================================================
// APP
// ============================================================================

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(false);

  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("initializing");

  const [session, setSession] = useState<AppSession>(null);

  // --------------------------------------------------------------------------
  // DATABASE INITIALIZATION
  // --------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        console.log("[App] Starting application initialization...");

        await initializeDatabase();

        console.log("[App] SQLite initialization completed");

        // Inspect the schema only after initialization succeeds.
        inspectDatabaseSchema();

        if (mounted) {
          setDatabaseReady(true);
        }
      } catch (error) {
        console.error(
          "[App] Application initialization failed:",
          error,
        );

        if (mounted) {
          setDatabaseReady(false);
        }
      } finally {
        if (mounted) {
          setAppReady(true);
        }
      }
    }

    void initializeApp();

    return () => {
      mounted = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const {
          data,
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!mounted) {
          return;
        }

        const currentSession = data.session ?? null;

        setSession(currentSession);

        setAuthStatus(
          currentSession?.user
            ? "authenticated"
            : "unauthenticated",
        );
      } catch (error) {
        console.error(
          "[Auth] Failed to initialize session:",
          error,
        );

        if (!mounted) {
          return;
        }

        setSession(null);
        setAuthStatus("unauthenticated");
      }
    }

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) {
          return;
        }

        setSession(nextSession);

        setAuthStatus(
          nextSession?.user
            ? "authenticated"
            : "unauthenticated",
        );
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --------------------------------------------------------------------------
  // APPLICATION GATE
  // --------------------------------------------------------------------------

  if (!appReady || authStatus === "initializing") {
    return <AppLoadingScreen />;
  }

  // Keep authentication accessible if SQLite fails to initialize.
  // Database-dependent features should handle database errors themselves.
  if (authStatus === "unauthenticated" || !session?.user) {
    return <UnauthenticatedApp />;
  }

  return (
    <AuthenticatedApp
      session={session}
      databaseReady={databaseReady}
    />
  );
}

// ============================================================================
// LOADING SCREEN
// ============================================================================

function AppLoadingScreen() {
  return (
    <SafeAreaProvider>
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color="#247A4A"
        />
      </View>
    </SafeAreaProvider>
  );
}

// ============================================================================
// UNAUTHENTICATED APP
// ============================================================================

function UnauthenticatedApp() {
  const handleLogin = useCallback((sessionData: unknown) => {
    // The Supabase auth-state listener manages the actual session.
    console.log(
      "[Auth] Login callback received:",
      Boolean(sessionData),
    );
  }, []);

  return (
    <SafeAreaProvider>
      <LoginScreen onLogin={handleLogin} />
    </SafeAreaProvider>
  );
}

// ============================================================================
// AUTHENTICATED APP
// ============================================================================

function AuthenticatedApp({
  session,
  databaseReady,
}: {
  session: NonNullable<AppSession>;
  databaseReady: boolean;
}) {
  const user = session.user;

  // --------------------------------------------------------------------------
  // NAVIGATION STATE
  // --------------------------------------------------------------------------

  const [currentScreen, setCurrentScreen] =
    useState<ScreenKey>("home");

  const [visitedScreens, setVisitedScreens] =
    useState<VisitedScreens>(INITIAL_VISITED_SCREENS);

  // Update only the state that actually needs to change.
  const navigate = useCallback((screen: ScreenKey) => {
    setCurrentScreen((current) =>
      current === screen ? current : screen,
    );

    setVisitedScreens((previous) => {
      if (previous[screen]) {
        return previous;
      }

      return {
        ...previous,
        [screen]: true,
      };
    });
  }, []);

  // --------------------------------------------------------------------------
  // STABLE HOME CALLBACKS
  // --------------------------------------------------------------------------

  const openExercise = useCallback(() => {
    navigate("exercise");
  }, [navigate]);

  const openProgress = useCallback(() => {
    navigate("progress");
  }, [navigate]);

  const openProfile = useCallback(() => {
    navigate("profile");
  }, [navigate]);

  // --------------------------------------------------------------------------
  // TAB BAR
  // --------------------------------------------------------------------------

  const [tabBarHeight, setTabBarHeight] =
    useState(TAB_BAR_HEIGHT);

  const handleTabBarHeightChange = useCallback(
    (height: number) => {
      if (!Number.isFinite(height) || height <= 0) {
        return;
      }

      setTabBarHeight((previousHeight) => {
        if (Math.abs(previousHeight - height) <= 0.5) {
          return previousHeight;
        }

        return height;
      });
    },
    [],
  );

  const handleNavigate = useCallback(
    (screen: string) => {
      if (isScreenKey(screen)) {
        navigate(screen);
      }
    },
    [navigate],
  );

  const chatbotBottomOffset = tabBarHeight + CHATBOT_GAP;

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {/* Screen container */}

        <View style={styles.screenHost}>
          {visitedScreens.home && (
            <ScreenSlot active={currentScreen === "home"}>
              <MemoWellnessHome
                user={user}
                bottomOffset={tabBarHeight}
                onOpenBreathing={openExercise}
                onOpenExercise={openExercise}
                onOpenProgress={openProgress}
                onOpenMood={openProgress}
                onOpenProfile={openProfile}
              />
            </ScreenSlot>
          )}

          {visitedScreens.exercise && (
            <ScreenSlot active={currentScreen === "exercise"}>
              <MemoExerciseScreen user={user} />
            </ScreenSlot>
          )}

          {visitedScreens.progress && (
            <ScreenSlot active={currentScreen === "progress"}>
              <MemoProgressScreen user={user} />
            </ScreenSlot>
          )}

          {visitedScreens.profile && (
            <ScreenSlot active={currentScreen === "profile"}>
              <MemoProfileScreen user={user} />
            </ScreenSlot>
          )}
        </View>

        {/* Persistent bottom navigation */}

        <BottomNavigation
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          onHeightChange={handleTabBarHeightChange}
        />

        {/* Persistent chatbot */}

        <FloatingChatbot
          bottomOffset={chatbotBottomOffset}
        />

        {/* Small offline/database warning indicator */}

        {!databaseReady && (
          <View
            pointerEvents="none"
            style={styles.databaseWarning}
          >
            <View style={styles.warningDot} />
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

// ============================================================================
// SCREEN SLOT
// ============================================================================

function ScreenSlot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={
        active
          ? styles.slotActive
          : styles.slotHidden
      }
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={
        active ? "auto" : "no-hide-descendants"
      }
    >
      {children}
    </View>
  );
}

// ============================================================================
// TYPE GUARD
// ============================================================================

function isScreenKey(value: unknown): value is ScreenKey {
  return (
    value === "home" ||
    value === "exercise" ||
    value === "progress" ||
    value === "profile"
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FAF7",
  },

  screenHost: {
    flex: 1,
  },

  slotActive: {
    flex: 1,
  },

  slotHidden: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5FAF7",
  },

  databaseWarning: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

//  npx react-native run-android

// cd C:\Users\Lenovo\Desktop\WellnessAIAssistant\android
// .\gradlew.bat assembleRelease
