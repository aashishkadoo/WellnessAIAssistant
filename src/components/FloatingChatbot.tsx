// src/components/FloatingChatbot.tsx
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Keyboard,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
};

type Props = {
  /**
   * Height of your BottomNavigation bar.
   * Keep this in sync with App.tsx's TAB_BAR_HEIGHT.
   */
  bottomOffset?: number;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function FloatingChatbot({ bottomOffset = 92 }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hi! I'm your Wellness AI companion 🌿 How are you feeling today?",
      sender: "ai",
    },
  ]);

  const listRef = useRef<FlatList<Message>>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Auto-scroll to bottom whenever a new message arrives or modal opens
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [messages, visible]);

  // Slide-in animation when opened
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
        mass: 0.9,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  const sendMessage = () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: message.trim(),
      sender: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");

    // Temporary AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text:
          "Thank you for sharing that with me. Remember to take a moment to breathe and be kind to yourself. 💚",
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 700);
  };

  return (
    <>
      {/* ---------- FLOATING BUTTON ---------- */}
      <TouchableOpacity
        style={[
          styles.fabWrapper,
          {
            bottom: bottomOffset + insets.bottom,
            right: 20,
          },
        ]}
        onPress={() => {
          Keyboard.dismiss();
          setVisible(true);
        }}
        activeOpacity={0.85}
        accessibilityLabel="Open Wellness AI chat"
      >
        <LinearGradient
          colors={["#34D399", "#10B981", "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          {/* Main chat icon */}
          <Text style={styles.fabIcon}>💬</Text>

          {/* Sparkle badge, top-right */}
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeIcon}>✨</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* ---------- CHAT OVERLAY ---------- */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        {/* Tappable scrim — tap outside to close */}
        <Pressable style={styles.scrim} onPress={() => setVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.kbWrapper}
            pointerEvents="box-none"
          >
            {/* Stop taps inside the card from closing the modal */}
            <Pressable style={styles.cardTouchable} onPress={() => {}}>
              <Animated.View
                style={[
                  styles.chatCard,
                  {
                    marginBottom: bottomOffset + insets.bottom + 8,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/* HEADER */}
                <View style={styles.chatHeader}>
                  <View style={styles.headerLeft}>
                    <LinearGradient
                      colors={["#34D399", "#059669"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.headerAvatar}
                    >
                      <Text style={styles.headerAvatarIcon}>✨</Text>
                    </LinearGradient>

                    <View>
                      <Text style={styles.chatTitle}>Wellness AI</Text>
                      <Text style={styles.chatSubtitle}>
                        Your wellness companion
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setVisible(false)}
                    style={styles.closeButton}
                    accessibilityLabel="Close chat"
                  >
                    <Text style={styles.closeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* MESSAGES */}
                <FlatList
                  ref={listRef}
                  data={messages}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.messages}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() =>
                    listRef.current?.scrollToEnd({ animated: true })
                  }
                  onLayout={() =>
                    listRef.current?.scrollToEnd({ animated: false })
                  }
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.messageBubble,
                        item.sender === "user"
                          ? styles.userBubble
                          : styles.aiBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          item.sender === "user" && styles.userMessageText,
                        ]}
                      >
                        {item.text}
                      </Text>
                    </View>
                  )}
                />

                {/* INPUT */}
                <View style={styles.inputContainer}>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Talk to Wellness AI..."
                    placeholderTextColor="#9AA59F"
                    style={styles.input}
                    multiline
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !message.trim() && styles.sendButtonDisabled,
                    ]}
                    onPress={sendMessage}
                    disabled={!message.trim()}
                  >
                    <Text style={styles.sendIcon}>↑</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* ---------- FAB ---------- */
  fabWrapper: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 31,

    // Android layering
    elevation: 14,
    zIndex: 999,

    // iOS glow
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  fabGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 31,
  },
  fabIcon: {
    fontSize: 26,
  },
  fabBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // tiny pop
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  fabBadgeIcon: {
    fontSize: 10,
  },

  /* ---------- Overlay scrim ---------- */
  scrim: {
    flex: 1,
    backgroundColor: "rgba(15, 30, 22, 0.35)",
    justifyContent: "flex-end",
  },
  kbWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  cardTouchable: {
    width: "100%",
    alignItems: "center",
  },

  /* ---------- Floating chat card ---------- */
  chatCard: {
    width: "92%",
    maxWidth: 480,
    height: SCREEN_HEIGHT * 0.62,
    maxHeight: 620,
    backgroundColor: "#F5FAF7",
    borderRadius: 24,
    overflow: "hidden",

    // Floating shadow
    shadowColor: "#0A1F14",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 20,
  },

  /* ---------- Header ---------- */
  chatHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5EDE8",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarIcon: {
    fontSize: 18,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#304138",
  },
  chatSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#8A958E",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF3EF",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize: 15,
    color: "#68756D",
    fontWeight: "700",
  },

  /* ---------- Messages ---------- */
  messages: {
    padding: 16,
    paddingBottom: 10,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  aiBubble: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: "#4CAF7D",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: "#4A574F",
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#FFFFFF",
  },

  /* ---------- Input ---------- */
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5EDE8",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: "#F1F5F2",
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: "#35443B",
    fontSize: 14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#4CAF7D",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#B9D6C5",
  },
  sendIcon: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: -2,
  },
});