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
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";
import {
  MessageCircle,
  Sparkles,
  X,
  Send,
  Leaf,
} from "lucide-react-native";

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

const COLORS = {
  green: "#247A4A",
  darkGreen: "#124B32",
  emerald: "#10B981",
  mint: "#D9F5E5",
  paleMint: "#EFF8F2",
  background: "#F5FAF7",
  white: "#FFFFFF",
  text: "#263D30",
  muted: "#84948A",
  border: "#E5EEE8",
};

export default function FloatingChatbot({
  bottomOffset = 92,
}: Props) {
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

  const slideAnim = useRef(
    new Animated.Value(SCREEN_HEIGHT),
  ).current;

  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.28)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const modalAnimationRef =
    useRef<Animated.CompositeAnimation | null>(null);

  // Gentle pulsing glow around the floating chatbot.
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.3,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.06,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.28,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    floating.start();

    return () => {
      pulse.stop();
      floating.stop();
    };
  }, [glowScale, glowOpacity, floatAnim]);

  // Automatically scroll to the newest message.
  useEffect(() => {
    if (messages.length === 0) return;

    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timeout);
  }, [messages, visible]);

  // Spring animation when the chat window opens.
  useEffect(() => {
    modalAnimationRef.current?.stop();

    if (visible) {
      slideAnim.setValue(SCREEN_HEIGHT);

      modalAnimationRef.current = Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 170,
        mass: 0.85,
      });

      modalAnimationRef.current.start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }

    return () => {
      modalAnimationRef.current?.stop();
    };
  }, [visible, slideAnim]);

  const closeChat = () => {
    Keyboard.dismiss();
    setVisible(false);
  };

  const sendMessage = () => {
    const trimmed = message.trim();

    if (!trimmed) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      text: trimmed,
      sender: "user",
    };

    setMessages((previous) => [...previous, userMessage]);
    setMessage("");

    // Temporary response. Replace with your AI API integration later.
    setTimeout(() => {
      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        text:
          "Thank you for sharing that with me. Take a moment to breathe, and remember to be kind to yourself. 💚",
        sender: "ai",
      };

      setMessages((previous) => [...previous, aiMessage]);
    }, 700);
  };

  return (
    <>
      {/* FLOATING CHATBOT BUTTON */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.fabPosition,
          {
            bottom: bottomOffset + insets.bottom,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        {/* Expanding outer glow */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowHalo,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />

        {/* Secondary static halo */}
        <View
          pointerEvents="none"
          style={styles.staticHalo}
        />

        <TouchableOpacity
          style={styles.fabTouchable}
          onPress={() => {
            Keyboard.dismiss();
            setVisible(true);
          }}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Open Wellness AI chat"
        >
          <LinearGradient
            colors={["#43D99A", "#10B981", "#08784D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <View style={styles.fabHighlight} />

            <MessageCircle
              size={27}
              color={COLORS.white}
              strokeWidth={2.3}
            />

            <View style={styles.fabSparkle}>
              <Sparkles
                size={13}
                color={COLORS.darkGreen}
                strokeWidth={2.4}
              />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Availability indicator */}
        <View style={styles.statusOuter}>
          <View style={styles.statusDot} />
        </View>
      </Animated.View>

      {/* CHAT MODAL */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={closeChat}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.scrim}
            onPress={closeChat}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.kbWrapper}
            pointerEvents="box-none"
          >
            <View style={styles.cardTouchable}>
              <Animated.View
                style={[
                  styles.chatCard,
                  {
                    marginBottom:
                      bottomOffset + insets.bottom + 8,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/* HEADER */}
                <LinearGradient
                  colors={["#FFFFFF", "#F5FBF7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.chatHeader}
                >
                  <View style={styles.headerLeft}>
                    <View style={styles.headerAvatarWrapper}>
                      <LinearGradient
                        colors={["#38D996", "#128453"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.headerAvatar}
                      >
                        <Leaf
                          size={21}
                          color={COLORS.white}
                          strokeWidth={2.2}
                        />
                      </LinearGradient>

                      <View style={styles.avatarStatus} />
                    </View>

                    <View style={styles.headerText}>
                      <View style={styles.titleRow}>
                        <Text style={styles.chatTitle}>
                          Wellness AI
                        </Text>
                        <Sparkles
                          size={14}
                          color={COLORS.green}
                        />
                      </View>

                      <Text style={styles.chatSubtitle}>
                        Your wellness companion
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={closeChat}
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close chat"
                    activeOpacity={0.7}
                  >
                    <X
                      size={19}
                      color="#64756A"
                      strokeWidth={2.2}
                    />
                  </TouchableOpacity>
                </LinearGradient>

                {/* WELCOME STRIP */}
                <View style={styles.welcomeStrip}>
                  <View style={styles.welcomeIcon}>
                    <Sparkles
                      size={15}
                      color={COLORS.green}
                    />
                  </View>
                  <Text style={styles.welcomeText}>
                    A little space for you to pause and reflect.
                  </Text>
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
                    listRef.current?.scrollToEnd({
                      animated: true,
                    })
                  }
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.messageRow,
                        item.sender === "user" &&
                          styles.userMessageRow,
                      ]}
                    >
                      {item.sender === "ai" && (
                        <View style={styles.messageAvatar}>
                          <Leaf
                            size={13}
                            color={COLORS.green}
                          />
                        </View>
                      )}

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
                            item.sender === "user" &&
                              styles.userMessageText,
                          ]}
                        >
                          {item.text}
                        </Text>
                      </View>
                    </View>
                  )}
                />

                {/* INPUT */}
                <View style={styles.inputArea}>
                  <View style={styles.inputContainer}>
                    <TextInput
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Share what's on your mind..."
                      placeholderTextColor="#9AA99F"
                      style={styles.input}
                      multiline
                      maxLength={2000}
                      returnKeyType="default"
                      textAlignVertical="center"
                      accessibilityLabel="Chat message"
                    />

                    <TouchableOpacity
                      style={[
                        styles.sendButton,
                        !message.trim() &&
                          styles.sendButtonDisabled,
                      ]}
                      onPress={sendMessage}
                      disabled={!message.trim()}
                      accessibilityRole="button"
                      accessibilityLabel="Send message"
                      activeOpacity={0.8}
                    >
                      <Send
                        size={17}
                        color={COLORS.white}
                        strokeWidth={2.4}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.inputFootnote}>
                    Take your time. One message at a time.
                  </Text>
                </View>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* FLOATING BUTTON */
  fabPosition: {
    position: "absolute",
    right: 20,
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 14,
  },

  glowHalo: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#10B981",
  },

  staticHalo: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.22)",
  },

  fabTouchable: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: "#0B8D5A",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },

  fabGradient: {
    flex: 1,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    overflow: "visible",
  },

  fabHighlight: {
    position: "absolute",
    top: 4,
    left: 9,
    width: 28,
    height: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.22)",
    transform: [{ rotate: "-24deg" }],
  },

  fabSparkle: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#D8F5E5",
    elevation: 4,
  },

  statusOuter: {
    position: "absolute",
    bottom: 2,
    right: 0,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C878",
    borderWidth: 1,
    borderColor: "#E8FFF0",
  },

  /* MODAL */
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },

  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 28, 18, 0.42)",
  },

  kbWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },

  cardTouchable: {
    width: "100%",
    alignItems: "center",
  },

  chatCard: {
    width: "92%",
    maxWidth: 480,
    height: SCREEN_HEIGHT * 0.64,
    maxHeight: 650,
    minHeight: 380,
    backgroundColor: COLORS.background,
    borderRadius: 27,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#0A2818",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 20,
  },

  /* HEADER */
  chatHeader: {
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  headerAvatarWrapper: {
    position: "relative",
  },

  headerAvatar: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarStatus: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#27C779",
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  headerText: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  chatTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.3,
  },

  chatSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.muted,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#EDF4EF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  /* WELCOME STRIP */
  welcomeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#EDF7F0",
    borderBottomWidth: 1,
    borderBottomColor: "#E0EEE4",
  },

  welcomeIcon: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#D9F0E1",
    alignItems: "center",
    justifyContent: "center",
  },

  welcomeText: {
    flex: 1,
    color: "#5D7666",
    fontSize: 11,
    fontWeight: "600",
  },

  /* MESSAGES */
  messages: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
    flexGrow: 1,
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 13,
    gap: 7,
  },

  userMessageRow: {
    justifyContent: "flex-end",
  },

  messageAvatar: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#DDF2E4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  messageBubble: {
    maxWidth: "83%",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
  },

  aiBubble: {
    backgroundColor: COLORS.white,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: "#E9F0EB",
    shadowColor: "#193D29",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 4,
    elevation: 1,
  },

  userBubble: {
    backgroundColor: "#248452",
    alignSelf: "flex-end",
    borderBottomRightRadius: 5,
  },

  messageText: {
    color: "#43574A",
    fontSize: 14,
    lineHeight: 21,
  },

  userMessageText: {
    color: COLORS.white,
  },

  /* INPUT */
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 5,
    paddingLeft: 15,
    backgroundColor: "#F3F7F4",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#E5EEE7",
  },

  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingVertical: 9,
    paddingRight: 8,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
    marginBottom: 0,
  },

  sendButtonDisabled: {
    backgroundColor: "#BBD9C6",
  },

  inputFootnote: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 10,
    color: "#9AA99F",
  },
});
