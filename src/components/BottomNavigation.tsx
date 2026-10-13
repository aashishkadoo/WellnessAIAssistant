// src/components/BottomNavigation.tsx
import * as React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Animated,
  LayoutChangeEvent,
} from "react-native";
import { Home, Activity, BarChart3, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NavItem = {
  key: string;
  label: string;
  Icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
};

const NAV_ITEMS: NavItem[] = [
  { key: "home",     label: "Home",     Icon: Home },
  { key: "exercise", label: "Exercise", Icon: Activity },
  { key: "progress", label: "Progress", Icon: BarChart3 },
  { key: "profile",  label: "Profile",  Icon: User },
];

type Props = {
  currentScreen: string;
  onNavigate: (screen: string) => void;
  /**
   * Fires with the bar's real, measured height (including safe-area
   * padding) every time it changes — e.g. on rotation. Use this instead of
   * a hardcoded constant when positioning things like a FloatingChatbot
   * above the bar, so they never overlap on devices with different insets.
   */
  onHeightChange?: (height: number) => void;
};

const ACTIVE_COLOR = "#3E9E6E";
const ACTIVE_BG = "#E6F6EE";
const INACTIVE_COLOR = "#8A958E";

export default function BottomNavigation({
  currentScreen,
  onNavigate,
  onHeightChange,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isLandscape = width > height;
  const iconSize  = isLandscape ? 20 : width < 360 ? 20 : width > 500 ? 26 : 22;
  const labelSize = isLandscape ? 10 : width < 360 ? 10 : 11.5;

  // Enough room for: circle indicator + gap + one line of label + top/bottom
  // padding, with a few px of buffer so nothing touches or overlaps.
  const barHeight = isLandscape ? 68 : 78;
  const circleSize = iconSize + 20;

  const handleLayout = (e: LayoutChangeEvent) => {
    onHeightChange?.(e.nativeEvent.layout.height);
  };

  return (
    <View
      pointerEvents="box-none"
      onLayout={handleLayout}
      style={[
        styles.wrapper,
        { paddingBottom: insets.bottom + (isLandscape ? 6 : 10) },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            height: barHeight,
            paddingHorizontal: isLandscape ? 20 : 10,
          },
        ]}
      >
        {NAV_ITEMS.map(({ key, label, Icon }) => (
          <NavButton
            key={key}
            label={label}
            Icon={Icon}
            active={currentScreen === key}
            onPress={() => onNavigate(key)}
            iconSize={iconSize}
            labelSize={labelSize}
            circleSize={circleSize}
          />
        ))}
      </View>
    </View>
  );
}

type NavButtonProps = {
  label: string;
  Icon: NavItem["Icon"];
  active: boolean;
  onPress: () => void;
  iconSize: number;
  labelSize: number;
  circleSize: number;
};

function NavButton({
  label,
  Icon,
  active,
  onPress,
  iconSize,
  labelSize,
  circleSize,
}: NavButtonProps) {
  // Drives the circular indicator's scale/opacity behind the icon.
  const progress = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  const pressScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  }, [active, progress]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const circleScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.item}
      android_ripple={{
        color: "#D6F1E1",
        borderless: true,
        radius: circleSize / 2,
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Animated.View
        style={[styles.iconRow, { transform: [{ scale: pressScale }] }]}
      >
        <View style={{ width: circleSize, height: circleSize }}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.circle,
              {
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2, // always a perfect circle
                opacity: progress,
                transform: [{ scale: circleScale }],
              },
            ]}
          />
          <View style={styles.iconCenter}>
            <Icon
              size={iconSize}
              color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
              strokeWidth={active ? 2.4 : 2}
            />
          </View>
        </View>
      </Animated.View>

      <Text
        style={[
          styles.label,
          {
            fontSize: labelSize,
            lineHeight: labelSize + 4,
            color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
            fontWeight: active ? "700" : "500",
          },
        ]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "transparent",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    ...Platform.select({
      android: { elevation: 12 },
      ios: {
        shadowColor: "#0B2E1F",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
    }),
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minWidth: 0, // lets long labels ("Exercise", "Progress") shrink instead of pushing siblings
  },
  iconRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  circle: {
    position: "absolute",
    backgroundColor: ACTIVE_BG,
  },
  iconCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    letterSpacing: 0.2,
    textAlign: "center",
  },
});