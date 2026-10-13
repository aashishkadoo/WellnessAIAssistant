import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

type Props = {
  user: any;
};

export default function ProgressScreen({ user }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Progress 📊</Text>
          <Text style={styles.subtitle}>
            Keep taking care of your mind.
          </Text>
        </View>

        {/* STREAK */}
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>

          <View>
            <Text style={styles.streakNumber}>7 Days</Text>
            <Text style={styles.streakText}>
              Current wellness streak
            </Text>
          </View>
        </View>

        {/* STATISTICS */}
        <Text style={styles.sectionTitle}>Your Statistics</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🧘</Text>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>
              Exercises
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🌬️</Text>
            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>
              Breathing Sessions
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={styles.statNumber}>96</Text>
            <Text style={styles.statLabel}>
              Minutes
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>😊</Text>
            <Text style={styles.statNumber}>82%</Text>
            <Text style={styles.statLabel}>
              Wellness Score
            </Text>
          </View>
        </View>

        {/* WEEKLY ACTIVITY */}
        <Text style={styles.sectionTitle}>
          This Week
        </Text>

        <View style={styles.weekCard}>
          <View style={styles.daysRow}>
            {[
              { day: "M", active: true },
              { day: "T", active: true },
              { day: "W", active: true },
              { day: "T", active: false },
              { day: "F", active: true },
              { day: "S", active: true },
              { day: "S", active: false },
            ].map((item, index) => (
              <View key={index} style={styles.dayItem}>
                <View
                  style={[
                    styles.dayCircle,
                    item.active &&
                      styles.dayCircleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      item.active &&
                        styles.dayTextActive,
                    ]}
                  >
                    {item.day}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.weekMessage}>
            Great job! You've been consistent this
            week. 🌿
          </Text>
        </View>

        {/* MOTIVATION */}
        <View style={styles.motivationCard}>
          <Text style={styles.motivationTitle}>
            Keep going 💚
          </Text>

          <Text style={styles.motivationText}>
            Small steps every day can make a big
            difference to your wellbeing.
          </Text>
        </View>
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
    paddingBottom: 110,
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

  streakCard: {
    backgroundColor: "#E7F6ED",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  streakEmoji: {
    fontSize: 38,
    marginRight: 16,
  },

  streakNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#3E9D70",
  },

  streakText: {
    marginTop: 3,
    color: "#708078",
    fontSize: 13,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#304138",
    marginBottom: 14,
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5EDE8",
  },

  statEmoji: {
    fontSize: 27,
    marginBottom: 8,
  },

  statNumber: {
    fontSize: 23,
    fontWeight: "800",
    color: "#3E9D70",
  },

  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#7C8982",
    textAlign: "center",
  },

  weekCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5EDE8",
    marginBottom: 20,
  },

  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  dayItem: {
    alignItems: "center",
  },

  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEF2EF",
    alignItems: "center",
    justifyContent: "center",
  },

  dayCircleActive: {
    backgroundColor: "#4CAF7D",
  },

  dayText: {
    color: "#89958E",
    fontWeight: "600",
  },

  dayTextActive: {
    color: "#FFFFFF",
  },

  weekMessage: {
    marginTop: 18,
    color: "#65736B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  motivationCard: {
    backgroundColor: "#DFF3E7",
    borderRadius: 20,
    padding: 20,
  },

  motivationTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#397A5B",
    marginBottom: 6,
  },

  motivationText: {
    color: "#60776A",
    fontSize: 14,
    lineHeight: 21,
  },
});