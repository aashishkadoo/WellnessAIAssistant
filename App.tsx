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

import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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

import {
  ScreenLayoutProvider,
  type ScreenLayout,
} from "./src/context/ScreenLayoutContext";

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

// ============================================================================
// CONSTANTS
// ============================================================================

export const TAB_BAR_HEIGHT = 72;

const CHATBOT_GAP = 24;

export const SCREEN_BOTTOM_GAP = 24;
export const SCREEN_HORIZONTAL_PADDING = 20;

// Only the additional spacing below the status bar.
// Do not add insets.top here because the screen is already
// laid out below the status bar on Android.
export const SCREEN_TOP_GAP = 8;

const APP_BACKGROUND = "#F5FAF7";
const PRIMARY_GREEN = "#247A4A";

const INITIAL_VISITED_SCREENS: VisitedScreens = {
  home: true,
  exercise: false,
  progress: false,
  profile: false,
};

// ============================================================================
// MEMOIZED SCREENS
// ============================================================================

const MemoWellnessHome = memo(WellnessHome);
const MemoExerciseScreen = memo(ExerciseScreen);
const MemoProgressScreen = memo(ProgressScreen);
const MemoProfileScreen = memo(ProfileScreen);

// ============================================================================
// APP ROOT
// ============================================================================

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

// ============================================================================
// APP CONTENT
// ============================================================================

function AppContent() {
  const [appReady, setAppReady] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(false);

  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("initializing");

  const [session, setSession] = useState<AppSession>(null);

  // ==========================================================================
  // DATABASE INITIALIZATION
  // ==========================================================================

  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        console.log("[App] Starting application initialization...");

        await initializeDatabase();

        console.log("[App] SQLite initialization completed");

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

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

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

  // ==========================================================================
  // APPLICATION GATE
  // ==========================================================================

  if (!appReady || authStatus === "initializing") {
    return <AppLoadingScreen />;
  }

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
    <View style={styles.loadingScreen}>
      <ActivityIndicator
        size="large"
        color={PRIMARY_GREEN}
      />
    </View>
  );
}

// ============================================================================
// UNAUTHENTICATED APP
// ============================================================================

function UnauthenticatedApp() {
  const handleLogin = useCallback((sessionData: unknown) => {
    console.log(
      "[Auth] Login callback received:",
      Boolean(sessionData),
    );
  }, []);

  return <LoginScreen onLogin={handleLogin} />;
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

  const insets = useSafeAreaInsets();

  // ==========================================================================
  // NAVIGATION STATE
  // ==========================================================================

  const [currentScreen, setCurrentScreen] =
    useState<ScreenKey>("home");

  const [visitedScreens, setVisitedScreens] =
    useState<VisitedScreens>(INITIAL_VISITED_SCREENS);

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

  // ==========================================================================
  // HOME CALLBACKS
  // ==========================================================================

  const openExercise = useCallback(() => {
    navigate("exercise");
  }, [navigate]);

  const openProgress = useCallback(() => {
    navigate("progress");
  }, [navigate]);

  const openProfile = useCallback(() => {
    navigate("profile");
  }, [navigate]);

  // ==========================================================================
  // BOTTOM NAVIGATION MEASUREMENT
  // ==========================================================================

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

  // ==========================================================================
  // SCREEN NAVIGATION
  // ==========================================================================

  const handleNavigate = useCallback(
    (screen: string) => {
      if (isScreenKey(screen)) {
        navigate(screen);
      }
    },
    [navigate],
  );

  // ==========================================================================
  // SHARED SCREEN LAYOUT
  // ==========================================================================

  const screenLayout: ScreenLayout = {
  // Match the top spacing used by WellnessHome.
  topPadding: insets.top + SCREEN_TOP_GAP,

  horizontalPadding: SCREEN_HORIZONTAL_PADDING,

  bottomPadding: tabBarHeight + SCREEN_BOTTOM_GAP,

  bottomNavigationHeight: tabBarHeight,
};

  // ==========================================================================
  // CHATBOT POSITIONING
  // ==========================================================================

  const chatbotBottomOffset =
    Math.max(0, tabBarHeight - insets.bottom) + CHATBOT_GAP;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <ScreenLayoutProvider value={screenLayout}>
      <View style={styles.container}>
        {/* SCREEN HOST */}

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

        {/* PERSISTENT BOTTOM NAVIGATION */}

        <BottomNavigation
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          onHeightChange={handleTabBarHeightChange}
        />

        {/* PERSISTENT CHATBOT */}

        <FloatingChatbot
          bottomOffset={chatbotBottomOffset}
        />

        {/* DATABASE WARNING */}

        {!databaseReady && (
          <View
            pointerEvents="none"
            style={styles.databaseWarning}
          >
            <View style={styles.warningDot} />
          </View>
        )}
      </View>
    </ScreenLayoutProvider>
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
    backgroundColor: APP_BACKGROUND,
  },

  screenHost: {
    flex: 1,
  },

  slotActive: {
    flex: 1,
  },

  slotHidden: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: APP_BACKGROUND,
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
