// src/screens/ProfileScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
} from "react-native";

import LinearGradient from "react-native-linear-gradient";

import {
  UserRound,
  Mail,
  Leaf,
  Bell,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Sparkles,
  Settings2,
  Heart,
  Camera,
} from "lucide-react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { launchImageLibrary } from "react-native-image-picker";

import { supabase } from "../lib/supabase";

import {
  getCurrentProfile,
  updateProfilePicture,
  removeProfilePicture,
  UserProfile,
} from "../services/profileService";

import NotificationScreen from "../components/NotificationScreen";

// ============================================================
// TYPES
// ============================================================

type Props = {
  user: any;
};

type ProfileOptionProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  backgroundColor?: string;
  onPress?: () => void;
  showArrow?: boolean;
};

// ============================================================
// PROFILE OPTION COMPONENT
// ============================================================

function ProfileOption({
  icon,
  title,
  description,
  backgroundColor = "#EAF5EE",
  onPress,
  showArrow = false,
}: ProfileOptionProps) {
  const content = (
    <>
      <View style={[styles.optionIcon, { backgroundColor }]}>
        {icon}
      </View>

      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{title}</Text>

        <Text
          style={styles.optionDescription}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>

      {showArrow && (
        <ChevronRight
          size={19}
          color="#91A198"
          strokeWidth={2}
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.optionCard}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${description}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.optionCard}>
      {content}
    </View>
  );
}

// ============================================================
// PROFILE SCREEN
// ============================================================

export default function ProfileScreen({ user }: Props) {
  const insets = useSafeAreaInsets();

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [showNotificationScreen, setShowNotificationScreen] =
    useState(false);

  // ----------------------------------------------------------
  // PROFILE INFORMATION
  // ----------------------------------------------------------

  const email = useMemo(() => {
    return (
      profile?.email?.trim() ||
      user?.email?.trim() ||
      "No email available"
    );
  }, [profile?.email, user?.email]);

  const displayName = useMemo(() => {
    return (
      profile?.full_name?.trim() ||
      user?.user_metadata?.full_name?.trim() ||
      user?.user_metadata?.name?.trim() ||
      "Wellness Member"
    );
  }, [
    profile?.full_name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
  ]);

  const initial = useMemo(() => {
    if (displayName !== "Wellness Member") {
      return displayName.charAt(0).toUpperCase();
    }

    if (email !== "No email available") {
      return email.charAt(0).toUpperCase();
    }

    return "W";
  }, [displayName, email]);

  const memberSince = useMemo(() => {
    const dateValue = profile?.created_at || user?.created_at;

    if (!dateValue) {
      return null;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [profile?.created_at, user?.created_at]);

  // ----------------------------------------------------------
  // LOAD PROFILE
  // ----------------------------------------------------------

  const loadProfile = useCallback(async () => {
    try {
      setLoadingProfile(true);

      const result = await getCurrentProfile();

      setProfile(result);
    } catch (error: any) {
      console.warn(
        "[ProfileScreen] Profile loading failed:",
        error,
      );
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // ----------------------------------------------------------
  // PROFILE IMAGE SOURCE
  // ----------------------------------------------------------

  const avatarSource = useMemo(() => {
    if (profile?.avatar_local_data) {
      return {
        uri: `data:image/jpeg;base64,${profile.avatar_local_data}`,
      };
    }

    if (profile?.avatar_url) {
      return {
        uri: profile.avatar_url,
      };
    }

    return null;
  }, [
    profile?.avatar_local_data,
    profile?.avatar_url,
  ]);

  // ----------------------------------------------------------
  // SELECT PROFILE PICTURE
  // ----------------------------------------------------------

  const handlePickAvatar = async () => {
    if (uploadingAvatar) {
      return;
    }

    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        Alert.alert(
          "Unable to select image",
          result.errorMessage || "Please try again.",
        );

        return;
      }

      const selectedImage = result.assets?.[0];

      if (!selectedImage?.base64) {
        Alert.alert(
          "Image unavailable",
          "We couldn't read this image. Please select another one.",
        );

        return;
      }

      setUploadingAvatar(true);

      const updatedProfile = await updateProfilePicture(
        selectedImage.base64,
      );

      setProfile(updatedProfile);

      Alert.alert(
        "Profile picture updated",
        "Your new picture has been saved on this device and is ready to synchronize.",
      );
    } catch (error: any) {
      console.error(
        "[ProfileScreen] Avatar update failed:",
        error,
      );

      Alert.alert(
        "Unable to update picture",
        error?.message || "Please try selecting another image.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ----------------------------------------------------------
  // REMOVE PROFILE PICTURE
  // ----------------------------------------------------------

  const handleRemoveAvatar = () => {
    if (!avatarSource || uploadingAvatar) {
      return;
    }

    Alert.alert(
      "Remove profile picture",
      "Are you sure you want to remove your profile picture?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",

          onPress: async () => {
            try {
              setUploadingAvatar(true);

              const updatedProfile =
                await removeProfilePicture();

              setProfile(updatedProfile);

              Alert.alert(
                "Picture removed",
                "Your profile picture removal has been saved.",
              );
            } catch (error: any) {
              console.error(
                "[ProfileScreen] Avatar removal failed:",
                error,
              );

              Alert.alert(
                "Unable to remove picture",
                error?.message || "Please try again.",
              );
            } finally {
              setUploadingAvatar(false);
            }
          },
        },
      ],
    );
  };

  // ----------------------------------------------------------
  // PROFILE PICTURE ACTIONS
  // ----------------------------------------------------------

  const handleAvatarActions = () => {
    if (uploadingAvatar) {
      return;
    }

    Alert.alert(
      "Profile picture",
      "Manage your profile picture.",
      [
        {
          text: "Choose a new picture",
          onPress: () => {
            void handlePickAvatar();
          },
        },

        ...(avatarSource
          ? [
              {
                text: "Remove picture",
                style: "destructive" as const,
                onPress: handleRemoveAvatar,
              },
            ]
          : []),

        {
          text: "Cancel",
          style: "cancel",
        },
      ],
    );
  };

  // ----------------------------------------------------------
  // NOTIFICATIONS NAVIGATION
  // ----------------------------------------------------------

  const handleOpenNotifications = useCallback(() => {
    setShowNotificationScreen(true);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setShowNotificationScreen(false);
  }, []);

  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out of Wellness AI?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },

        {
          text: "Log out",
          style: "destructive",

          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();

              if (error) {
                Alert.alert(
                  "Unable to log out",
                  error.message || "Please try again.",
                );
              }
            } catch (error) {
              console.error(
                "[ProfileScreen] Logout failed:",
                error,
              );

              Alert.alert(
                "Something went wrong",
                "We couldn't log you out. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  // ==========================================================
  // NOTIFICATION SCREEN
  // ==========================================================

  if (showNotificationScreen) {
    return (
      <NotificationScreen
        user={user}
        onClose={handleCloseNotifications}
      />
    );
  }

  // ==========================================================
  // MAIN PROFILE SCREEN
  // ==========================================================

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            // Background extends behind the transparent status bar.
            // Content starts safely below the status bar.
            // No additional top spacing is added.
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, 12) + 105,
          },
        ]}
      >
        {/* PAGE HEADER */}

        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderText}>
            <Text style={styles.eyebrow}>
              YOUR PERSONAL SPACE
            </Text>

            <Text style={styles.pageTitle}>
              My Profile
            </Text>

            <Text style={styles.pageSubtitle}>
              Your wellness journey, all in one place.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Settings2
              size={23}
              color="#247A4A"
              strokeWidth={2}
            />
          </View>
        </View>

        {/* PROFILE HERO */}

        <LinearGradient
          colors={["#287D50", "#17623D", "#124B32"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHero}
        >
          <View style={styles.heroDecorationOne} />

          <View style={styles.heroDecorationTwo} />

          <View style={styles.heroTopRow}>
            <View style={styles.avatarOuter}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleAvatarActions}
                disabled={uploadingAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile picture"
              >
                <LinearGradient
                  colors={["#E7F8ED", "#C6EAD4"]}
                  style={styles.avatar}
                >
                  {avatarSource ? (
                    <Image
                      source={avatarSource}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : displayName !== "Wellness Member" ? (
                    <Text style={styles.avatarText}>
                      {initial}
                    </Text>
                  ) : (
                    <UserRound
                      size={38}
                      color="#247A4A"
                      strokeWidth={1.8}
                    />
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleAvatarActions}
                disabled={uploadingAvatar}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Select profile picture"
              >
                {uploadingAvatar ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Camera
                    size={15}
                    color="#FFFFFF"
                    strokeWidth={2.5}
                  />
                )}
              </TouchableOpacity>

              <View style={styles.onlineIndicator} />
            </View>

            <View style={styles.memberBadge}>
              <Sparkles
                size={13}
                color="#D5F4DE"
                strokeWidth={2}
              />

              <Text style={styles.memberBadgeText}>
                MEMBER
              </Text>
            </View>
          </View>

          <Text
            style={styles.profileName}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          <View style={styles.emailRow}>
            <Mail
              size={15}
              color="#D2EBDD"
              strokeWidth={1.8}
            />

            <Text
              style={styles.profileEmail}
              numberOfLines={2}
            >
              {email}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.changePhotoButton}
            onPress={handleAvatarActions}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
          >
            <Camera
              size={13}
              color="#E1F6E8"
            />

            <Text style={styles.changePhotoText}>
              {uploadingAvatar
                ? "Updating picture..."
                : avatarSource
                  ? "Change profile picture"
                  : "Add profile picture"}
            </Text>

            <ChevronRight
              size={15}
              color="#D5F4DE"
            />
          </TouchableOpacity>

          <View style={styles.heroDivider} />

          <View style={styles.memberFooter}>
            <View style={styles.memberFooterIcon}>
              <Heart
                size={16}
                color="#D5F4DE"
                strokeWidth={2}
              />
            </View>

            <View style={styles.memberFooterText}>
              <Text style={styles.memberFooterTitle}>
                Your wellbeing matters
              </Text>

              <Text style={styles.memberFooterSubtitle}>
                Small steps. Healthier habits.
              </Text>
            </View>

            {memberSince && (
              <View style={styles.memberSince}>
                <Text style={styles.memberSinceLabel}>
                  MEMBER SINCE
                </Text>

                <Text style={styles.memberSinceValue}>
                  {memberSince}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* PROFILE LOADING */}

        {loadingProfile && (
          <View style={styles.profileLoading}>
            <ActivityIndicator color="#247A4A" />

            <Text style={styles.profileLoadingText}>
              Loading your profile...
            </Text>
          </View>
        )}

        {/* ACCOUNT SECTION */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Account
            </Text>

            <Text style={styles.sectionSubtitle}>
              Your account information
            </Text>
          </View>

          <View style={styles.sectionIcon}>
            <UserRound
              size={18}
              color="#247A4A"
            />
          </View>
        </View>

        <View style={styles.optionsGroup}>
          <ProfileOption
            icon={
              <Mail
                size={21}
                color="#247A4A"
                strokeWidth={1.9}
              />
            }
            title="Email address"
            description={email}
            showArrow={false}
          />

          <View style={styles.cardDivider} />

          <ProfileOption
            icon={
              <Leaf
                size={21}
                color="#247A4A"
                strokeWidth={1.9}
              />
            }
            title="Wellness journey"
            description={
              profile?.wellness_goal?.trim() ||
              "Build healthy habits at your own pace"
            }
            showArrow={false}
          />
        </View>

        {/* PREFERENCES AND PRIVACY */}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Preferences & Privacy
            </Text>

            <Text style={styles.sectionSubtitle}>
              Your comfort and peace of mind
            </Text>
          </View>

          <View style={styles.sectionIcon}>
            <ShieldCheck
              size={18}
              color="#247A4A"
            />
          </View>
        </View>

        <View style={styles.optionsGroup}>
          <ProfileOption
            icon={
              <Bell
                size={21}
                color="#B77A25"
                strokeWidth={1.9}
              />
            }
            backgroundColor="#FFF3DF"
            title="Notifications"
            description="Manage your wellness reminders and updates"
            showArrow={true}
            onPress={handleOpenNotifications}
          />

          <View style={styles.cardDivider} />

          <ProfileOption
            icon={
              <ShieldCheck
                size={21}
                color="#5475BB"
                strokeWidth={1.9}
              />
            }
            backgroundColor="#EAF0FF"
            title="Privacy & security"
            description="Your wellness information deserves care"
            showArrow={false}
          />
        </View>

        {/* WELLNESS MESSAGE */}

        <LinearGradient
          colors={["#E7F5EC", "#F0F8F2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wellnessNote}
        >
          <View style={styles.wellnessNoteIcon}>
            <Heart
              size={21}
              color="#247A4A"
              strokeWidth={1.9}
            />
          </View>

          <View style={styles.wellnessNoteContent}>
            <Text style={styles.wellnessNoteTitle}>
              Take a moment for yourself
            </Text>

            <Text style={styles.wellnessNoteText}>
              Rest is productive, progress takes time, and every small
              step counts.
            </Text>
          </View>
        </LinearGradient>

        {/* LOGOUT */}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out of Wellness AI"
        >
          <View style={styles.logoutIcon}>
            <LogOut
              size={19}
              color="#C94F4F"
              strokeWidth={2}
            />
          </View>

          <Text style={styles.logoutText}>
            Log Out
          </Text>

          <View style={styles.logoutSpacer} />

          <ChevronRight
            size={19}
            color="#D38A8A"
          />
        </TouchableOpacity>

        {/* FOOTER */}

        <Text style={styles.footerText}>
          WELLNESS AI · YOUR JOURNEY, YOUR PACE
        </Text>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F8F5",
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
  },

  // PAGE HEADER

  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },

  pageHeaderText: {
    flex: 1,
    paddingRight: 12,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#568568",
    marginBottom: 7,
  },

  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#20372A",
    letterSpacing: -0.8,
  },

  pageSubtitle: {
    fontSize: 13,
    color: "#829087",
    marginTop: 5,
    lineHeight: 19,
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#E5F2E9",
    borderWidth: 1,
    borderColor: "#D8EADF",
    alignItems: "center",
    justifyContent: "center",
  },

  // PROFILE HERO

  profileHero: {
    borderRadius: 27,
    padding: 23,
    marginBottom: 29,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#37845C",
    shadowColor: "#185C38",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 7,
  },

  heroDecorationOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.045)",
    top: -95,
    right: -55,
  },

  heroDecorationTwo: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 63,
    backgroundColor: "rgba(255,255,255,0.035)",
    bottom: -75,
    right: 45,
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 19,
  },

  // AVATAR

  avatarOuter: {
    position: "relative",
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },

  avatarText: {
    fontSize: 35,
    fontWeight: "800",
    color: "#247A4A",
  },

  cameraButton: {
    position: "absolute",
    right: -5,
    bottom: -5,
    width: 31,
    height: 31,
    borderRadius: 16,
    backgroundColor: "#247A4A",
    borderWidth: 3,
    borderColor: "#216B44",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },

  onlineIndicator: {
    position: "absolute",
    right: -3,
    top: -3,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#65D99A",
    borderWidth: 2,
    borderColor: "#216B44",
    zIndex: 2,
  },

  changePhotoButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  changePhotoText: {
    color: "#E1F6E8",
    fontSize: 11,
    fontWeight: "700",
  },

  // MEMBER BADGE

  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },

  memberBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#E1F6E8",
  },

  // PROFILE DETAILS

  profileName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },

  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 9,
  },

  profileEmail: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "#D7EBDD",
  },

  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 21,
  },

  // MEMBER FOOTER

  memberFooter: {
    flexDirection: "row",
    alignItems: "center",
  },

  memberFooterIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  memberFooterText: {
    flex: 1,
  },

  memberFooterTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  memberFooterSubtitle: {
    fontSize: 10,
    color: "#C9E5D2",
    marginTop: 4,
  },

  memberSince: {
    alignItems: "flex-end",
    marginLeft: 8,
  },

  memberSinceLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.7,
    color: "#B8DCC5",
  },

  memberSinceValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 5,
  },

  profileLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },

  profileLoadingText: {
    color: "#829087",
    fontSize: 12,
  },

  // SECTION HEADERS

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#293D31",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: "#87948B",
    marginTop: 4,
  },

  sectionIcon: {
    width: 37,
    height: 37,
    borderRadius: 13,
    backgroundColor: "#E6F2E9",
    alignItems: "center",
    justifyContent: "center",
  },

  // OPTION GROUPS

  optionsGroup: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#E7EEE9",
    marginBottom: 27,
    shadowColor: "#234B34",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 2,
  },

  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    minHeight: 78,
  },

  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  optionContent: {
    flex: 1,
    paddingRight: 8,
  },

  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#304238",
  },

  optionDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: "#8A978F",
    marginTop: 5,
  },

  cardDivider: {
    height: 1,
    backgroundColor: "#EEF2EF",
    marginLeft: 59,
  },

  // WELLNESS NOTE

  wellnessNote: {
    flexDirection: "row",
    alignItems: "center",
    padding: 17,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#DDEDE2",
    marginBottom: 23,
  },

  wellnessNoteIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  wellnessNoteContent: {
    flex: 1,
  },

  wellnessNoteTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2D5C3E",
  },

  wellnessNoteText: {
    fontSize: 11,
    lineHeight: 17,
    color: "#718779",
    marginTop: 5,
  },

  // LOGOUT

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 59,
    paddingHorizontal: 15,
    borderRadius: 18,
    backgroundColor: "#FFF7F6",
    borderWidth: 1,
    borderColor: "#F3DEDC",
  },

  logoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FCE8E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  logoutText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#C94F4F",
  },

  logoutSpacer: {
    flex: 1,
  },

  // FOOTER

  footerText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
    textAlign: "center",
    color: "#A0ACA4",
    marginTop: 23,
  },
});
