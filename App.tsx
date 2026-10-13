// App.tsx

import React, {
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

import { supabase } from "./src/lib/supabase";
import { initializeDatabase } from "./src/database/database";

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
// APP
// ============================================================================

export default function App() {
  // --------------------------------------------------------------------------
  // APPLICATION INITIALIZATION
  // --------------------------------------------------------------------------

  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        // SQLite must be ready before the authenticated application starts.
        await initializeDatabase();

        // Temporary diagnostic message to verify SQLite initialization.
        console.log("[SQLite] Ready");

        if (mounted) {
          setAppReady(true);
        }
      } catch (error) {
        console.error(
          "[App] Application initialization failed:",
          error
        );

        // We currently keep the app alive even if local database
        // initialization fails. This prevents a database problem from
        // completely blocking authentication.
        //
        // Later, once offline-first storage is fully integrated, this can
        // become a proper database error/recovery screen.
        if (mounted) {
          setAppReady(true);
        }
      }
    }

    initializeApp();

    return () => {
      mounted = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------

  const [authStatus, setAuthStatus] =
    useState<AuthStatus>("initializing");

  const [session, setSession] =
    useState<any>(null);

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
            : "unauthenticated"
        );
      } catch (error) {
        console.error(
          "[Auth] Failed to initialize session:",
          error
        );

        if (!mounted) {
          return;
        }

        setSession(null);
        setAuthStatus("unauthenticated");
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) {
          return;
        }

        setSession(nextSession);

        if (nextSession?.user) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // --------------------------------------------------------------------------
  // APP GATE
  // --------------------------------------------------------------------------

  if (!appReady || authStatus === "initializing") {
    return <AppLoadingScreen />;
  }

  if (authStatus === "unauthenticated" || !session?.user) {
    return <UnauthenticatedApp />;
  }

  return (
    <AuthenticatedApp
      session={session}
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
  const handleLogin = useCallback(
    (sessionData: any) => {
      // LoginScreen remains compatible with the existing onLogin prop.
      //
      // The Supabase auth listener remains the actual source of truth.
      // This callback simply allows LoginScreen to continue working without
      // requiring a navigation/auth architecture rewrite.
      console.log(
        "[Auth] Login callback received:",
        Boolean(sessionData)
      );
    },
    []
  );

  return (
    <SafeAreaProvider>
      <LoginScreen
        onLogin={handleLogin}
      />
    </SafeAreaProvider>
  );
}

// ============================================================================
// AUTHENTICATED APP
// ============================================================================

function AuthenticatedApp({
  session,
}: {
  session: any;
}) {
  const user = session.user;

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  const [
    currentScreen,
    setCurrentScreen,
  ] = useState<ScreenKey>("home");

  const [
    visitedScreens,
    setVisitedScreens,
  ] = useState<VisitedScreens>(
    INITIAL_VISITED_SCREENS
  );

  const navigate = useCallback(
    (screen: ScreenKey) => {
      setVisitedScreens((previous) => {
        if (previous[screen]) {
          return previous;
        }

        return {
          ...previous,
          [screen]: true,
        };
      });

      setCurrentScreen(screen);
    },
    []
  );

  // --------------------------------------------------------------------------
  // TAB BAR
  // --------------------------------------------------------------------------

  const [
    tabBarHeight,
    setTabBarHeight,
  ] = useState(TAB_BAR_HEIGHT);

  const handleTabBarHeightChange =
    useCallback((height: number) => {
      if (!Number.isFinite(height) || height <= 0) {
        return;
      }

      setTabBarHeight((previousHeight) => {
        if (
          Math.abs(previousHeight - height) <= 0.5
        ) {
          return previousHeight;
        }

        return height;
      });
    }, []);

  const chatbotBottomOffset =
    tabBarHeight + CHATBOT_GAP;

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <View style={styles.screenHost}>
          {visitedScreens.home && (
            <ScreenSlot
              active={currentScreen === "home"}
            >
              <WellnessHome
                user={user}
                bottomOffset={tabBarHeight}
                onOpenBreathing={() =>
                  navigate("exercise")
                }
                onOpenExercise={() =>
                  navigate("exercise")
                }
                onOpenProgress={() =>
                  navigate("progress")
                }
                onOpenMood={() =>
                  navigate("progress")
                }
                onOpenProfile={() =>
                  navigate("profile")
                }
              />
            </ScreenSlot>
          )}

          {visitedScreens.exercise && (
            <ScreenSlot
              active={
                currentScreen === "exercise"
              }
            >
              <ExerciseScreen
                user={user}
              />
            </ScreenSlot>
          )}

          {visitedScreens.progress && (
            <ScreenSlot
              active={
                currentScreen === "progress"
              }
            >
              <ProgressScreen
                user={user}
              />
            </ScreenSlot>
          )}

          {visitedScreens.profile && (
            <ScreenSlot
              active={
                currentScreen === "profile"
              }
            >
              <ProfileScreen
                user={user}
              />
            </ScreenSlot>
          )}
        </View>

        <BottomNavigation
          currentScreen={currentScreen}
          onNavigate={(screen) => {
            if (isScreenKey(screen)) {
              navigate(screen);
            }
          }}
          onHeightChange={
            handleTabBarHeightChange
          }
        />

        <FloatingChatbot
          bottomOffset={
            chatbotBottomOffset
          }
        />
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
      pointerEvents={
        active
          ? "auto"
          : "none"
      }
      accessibilityElementsHidden={
        !active
      }
      importantForAccessibility={
        active
          ? "auto"
          : "no-hide-descendants"
      }
    >
      {children}
    </View>
  );
}

// ============================================================================
// TYPE GUARD
// ============================================================================

function isScreenKey(
  value: unknown
): value is ScreenKey {
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
});

// npx react-native run-android