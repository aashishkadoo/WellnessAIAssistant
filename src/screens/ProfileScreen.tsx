import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";

type Props = {
  user: any;
};

export default function ProfileScreen({ user }: Props) {
  const handleLogout = async () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const email =
    user?.email || "No email available";

  const initial =
    email.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile 👤</Text>
          <Text style={styles.subtitle}>
            Manage your wellness account.
          </Text>
        </View>

        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initial}
            </Text>
          </View>

          <Text style={styles.email}>
            {email}
          </Text>

          <Text style={styles.memberText}>
            Wellness AI Member
          </Text>
        </View>

        {/* ACCOUNT */}
        <Text style={styles.sectionTitle}>
          Account
        </Text>

        <View style={styles.optionCard}>
          <View style={styles.optionIcon}>
            <Text>📧</Text>
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Email
            </Text>

            <Text style={styles.optionText}>
              {email}
            </Text>
          </View>
        </View>

        <View style={styles.optionCard}>
          <View style={styles.optionIcon}>
            <Text>🌿</Text>
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Wellness Journey
            </Text>

            <Text style={styles.optionText}>
              Your personal wellness companion
            </Text>
          </View>
        </View>

        {/* PREFERENCES */}
        <Text style={styles.sectionTitle}>
          Preferences
        </Text>

        <View style={styles.optionCard}>
          <View style={styles.optionIcon}>
            <Text>🔔</Text>
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Notifications
            </Text>

            <Text style={styles.optionText}>
              Wellness reminders and updates
            </Text>
          </View>
        </View>

        <View style={styles.optionCard}>
          <View style={styles.optionIcon}>
            <Text>🔒</Text>
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Privacy
            </Text>

            <Text style={styles.optionText}>
              Your wellness information stays private
            </Text>
          </View>
        </View>

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>
            Log Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FAF7",
  },

  content: {
    padding: 20,
    paddingBottom: 120,
  },

  header: {
    marginTop: 20,
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#26382E",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: "#7A887F",
  },

  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5EDE8",
    marginBottom: 28,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#DFF3E7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  avatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#4CAF7D",
  },

  email: {
    fontSize: 17,
    fontWeight: "700",
    color: "#304138",
  },

  memberText: {
    marginTop: 5,
    color: "#8A958E",
    fontSize: 13,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#304138",
    marginBottom: 12,
  },

  optionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5EDE8",
  },

  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF8F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  optionContent: {
    flex: 1,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#35443B",
  },

  optionText: {
    marginTop: 3,
    fontSize: 12,
    color: "#89958E",
  },

  logoutButton: {
    marginTop: 20,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E27B7B",
    alignItems: "center",
    justifyContent: "center",
  },

  logoutText: {
    color: "#D95F5F",
    fontWeight: "700",
    fontSize: 15,
  },
});