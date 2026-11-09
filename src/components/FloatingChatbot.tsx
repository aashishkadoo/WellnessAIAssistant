// src/components/FloatingChatbot.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
  ActivityIndicator,
  ScrollView,
  Alert,
  PermissionsAndroid,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import LinearGradient from "react-native-linear-gradient";

import {
  MessageCircle,
  Sparkles,
  X,
  Send,
  Leaf,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  BookHeart,
  Plus,
  Clock,
  Trash2,
  Edit3,
  MessageSquare,
  ChevronLeft,
  WifiOff,
} from "lucide-react-native";

import Tts from "react-native-tts";

import VoiceToText, {
  VoiceToTextEvents,
} from "@appcitor/react-native-voice-to-text";

import { supabase } from "../lib/supabase";

import {
  createConversation,
  getConversations,
  getChatMessages,
  saveChatMessage,
  generateConversationTitle,
  type ChatConversation,
  type ChatMessage,
} from "../services/aiChatStorage";

import { sendAIChatMessage } from "../services/aiChatService";

import {
  createJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
} from "../services/journalService";

// ============================================================================
// TYPES
// ============================================================================

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
  deliveryStatus?: string;
  createdAt?: string;
};

type JournalItem = {
  id: string;
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  bottomOffset?: number;
};

type ActiveTab = "chat" | "journal";

// ============================================================================
// CONSTANTS
// ============================================================================

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
  red: "#D9534F",
};

const INITIAL_GREETING =
  "Hi! I'm your Wellness AI companion 🌿 How are you feeling today?";

// ============================================================================
// HELPERS
// ============================================================================

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function mapStoredMessage(item: ChatMessage): Message {
  return {
    id: item.id,
    text: item.content,
    sender: item.sender,
    deliveryStatus: item.delivery_status,
    createdAt: item.created_at,
  };
}

function getJournalDate(entry: JournalItem): string {
  const value = entry.updatedAt || entry.createdAt;

  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FloatingChatbot({
  bottomOffset = 92,
}: Props) {
  const insets = useSafeAreaInsets();

  // --------------------------------------------------------------------------
  // MAIN STATE
  // --------------------------------------------------------------------------

  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [offlineNotice, setOfflineNotice] = useState("");

  // --------------------------------------------------------------------------
  // JOURNAL STATE
  // --------------------------------------------------------------------------

  const [journalEntries, setJournalEntries] = useState<JournalItem[]>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [savingJournal, setSavingJournal] = useState(false);

  const [editingJournalId, setEditingJournalId] = useState<string | null>(
    null,
  );

  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [journalMood, setJournalMood] = useState("");

  const [journalEditorVisible, setJournalEditorVisible] = useState(false);

  // --------------------------------------------------------------------------
  // REFS
  // --------------------------------------------------------------------------

  const listRef = useRef<FlatList<Message>>(null);

  const slideAnim = useRef(
    new Animated.Value(SCREEN_HEIGHT),
  ).current;

  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.28)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const modalAnimationRef =
    useRef<Animated.CompositeAnimation | null>(null);

  const currentConversationRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  // --------------------------------------------------------------------------
  // ANIMATIONS
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // MODAL ANIMATION
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // SPEECH EVENT LISTENERS
  // --------------------------------------------------------------------------

  useEffect(() => {
    const subscriptions = [
      VoiceToText.addEventListener(
        VoiceToTextEvents.START,
        () => {
          setIsListening(true);
        },
      ),

      VoiceToText.addEventListener(
        VoiceToTextEvents.END,
        () => {
          setIsListening(false);
        },
      ),

      VoiceToText.addEventListener(
        VoiceToTextEvents.RESULTS,
        (event) => {
          if (event.value?.trim()) {
            setMessage(event.value);
          }
        },
      ),

      VoiceToText.addEventListener(
        VoiceToTextEvents.PARTIAL_RESULTS,
        (event) => {
          if (event.value !== undefined) {
            setMessage(event.value);
          }
        },
      ),

      VoiceToText.addEventListener(
        VoiceToTextEvents.ERROR,
        (event) => {
          setIsListening(false);

          setErrorMessage(
            event.message || "Voice recognition failed.",
          );
        },
      ),
    ];

    return () => {
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });

      VoiceToText.destroy().catch(() => undefined);
      Tts.stop();
    };
  }, []);

  // --------------------------------------------------------------------------
  // TTS EVENTS
  // --------------------------------------------------------------------------

  useEffect(() => {
    const startSubscription = Tts.addEventListener(
      "tts-start",
      () => setIsSpeaking(true),
    );

    const finishSubscription = Tts.addEventListener(
      "tts-finish",
      () => setIsSpeaking(false),
    );

    const cancelSubscription = Tts.addEventListener(
      "tts-cancel",
      () => setIsSpeaking(false),
    );

    return () => {
      startSubscription.remove();
      finishSubscription.remove();
      cancelSubscription.remove();
    };
  }, []);

  // --------------------------------------------------------------------------
  // SCROLL TO LATEST MESSAGE
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!messages.length) return;

    const timeout = setTimeout(() => {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);

    return () => clearTimeout(timeout);
  }, [messages, visible]);

  // --------------------------------------------------------------------------
  // AUTHENTICATED USER
  // --------------------------------------------------------------------------

  const loadAuthenticatedUser = useCallback(async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      throw new Error(
        "Please sign in to use your Wellness AI companion.",
      );
    }

    setUserId(user.id);

    return user.id;
  }, []);

  // --------------------------------------------------------------------------
  // LOAD CONVERSATIONS
  // --------------------------------------------------------------------------

  const loadConversations = useCallback(
    async (uid: string) => {
      setLoadingHistory(true);

      try {
        const result = await getConversations(uid);

        setConversations(result);

        return result;
      } finally {
        setLoadingHistory(false);
      }
    },
    [],
  );

  // --------------------------------------------------------------------------
  // LOAD A CONVERSATION
  // --------------------------------------------------------------------------

  const loadConversation = useCallback(
    async (id: string, uid: string) => {
      setLoadingMessages(true);
      setErrorMessage("");
      setOfflineNotice("");

      try {
        const storedMessages = await getChatMessages(
          id,
          uid,
          200,
        );

        setConversationId(id);
        currentConversationRef.current = id;

        setMessages(storedMessages.map(mapStoredMessage));
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  // --------------------------------------------------------------------------
  // CREATE OR RESTORE CONVERSATION
  // --------------------------------------------------------------------------

  const initializeChat = useCallback(async () => {
    setLoadingMessages(true);
    setErrorMessage("");

    try {
      const uid = await loadAuthenticatedUser();

      const existingConversations = await loadConversations(uid);

      if (existingConversations.length > 0) {
        await loadConversation(
          existingConversations[0].id,
          uid,
        );
      } else {
        const created = await createConversation(uid);

        setConversationId(created.id);
        currentConversationRef.current = created.id;

        setConversations([created]);

        setMessages([
          {
            id: "welcome",
            text: INITIAL_GREETING,
            sender: "ai",
          },
        ]);
      }
    } catch (error) {
      setMessages([]);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoadingMessages(false);
    }
  }, [
    loadAuthenticatedUser,
    loadConversations,
    loadConversation,
  ]);

  // --------------------------------------------------------------------------
  // OPEN CHAT
  // --------------------------------------------------------------------------

  const openChat = useCallback(() => {
    Keyboard.dismiss();
    setVisible(true);
    setActiveTab("chat");
    setShowHistory(false);
    setJournalEditorVisible(false);

    initializeChat();
  }, [initializeChat]);

  // --------------------------------------------------------------------------
  // CLOSE CHAT
  // --------------------------------------------------------------------------

  const closeChat = useCallback(() => {
    Keyboard.dismiss();

    if (isListening) {
      VoiceToText.stopListening().catch(() => undefined);
    }

    Tts.stop();

    setIsSpeaking(false);
    setIsListening(false);
    setVisible(false);
    setShowHistory(false);
    setJournalEditorVisible(false);
  }, [isListening]);

  // --------------------------------------------------------------------------
  // CREATE NEW CONVERSATION
  // --------------------------------------------------------------------------

  const startNewConversation = useCallback(async () => {
    if (!userId) return;

    try {
      Tts.stop();

      const created = await createConversation(userId);

      setConversationId(created.id);
      currentConversationRef.current = created.id;

      setConversations((previous) => [
        created,
        ...previous,
      ]);

      setMessages([
        {
          id: "welcome",
          text: INITIAL_GREETING,
          sender: "ai",
        },
      ]);

      setShowHistory(false);
      setErrorMessage("");
      setOfflineNotice("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, [userId]);

  // --------------------------------------------------------------------------
  // SWITCH CONVERSATION
  // --------------------------------------------------------------------------

  const switchConversation = useCallback(
    async (id: string) => {
      if (!userId) return;

      setShowHistory(false);

      await loadConversation(id, userId);
    },
    [userId, loadConversation],
  );

  // --------------------------------------------------------------------------
  // SEND MESSAGE TO GEMINI
  // --------------------------------------------------------------------------

  const sendMessage = useCallback(async () => {
    const trimmed = message.trim();

    if (!trimmed || sendingRef.current) return;

    if (!userId || !conversationId) {
      setErrorMessage(
        "Your conversation is not ready. Please reopen the chat.",
      );
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setErrorMessage("");
    setOfflineNotice("");

    const currentConversation = conversationId;

    const temporaryMessage: Message = {
      id: `temporary-${Date.now()}`,
      text: trimmed,
      sender: "user",
      deliveryStatus: "pending",
    };

    setMessages((previous) => [
      ...previous,
      temporaryMessage,
    ]);

    setMessage("");

    try {
      const result = await sendAIChatMessage({
        conversationId: currentConversation,
        message: trimmed,
      });

      if (result.offline || !result.reply) {
        setMessages((previous) => [
          ...previous.filter(
            (item) => item.id !== temporaryMessage.id,
          ),
          {
            id: `offline-${Date.now()}`,
            text:
              "Your message has been saved on this device. Connect to the internet to receive an AI response. 🌿",
            sender: "ai",
          },
        ]);

        setOfflineNotice(
          "You're offline. Your message is saved locally.",
        );
      } else {
        const aiMessage: Message = result.aiMessage
          ? mapStoredMessage(result.aiMessage)
          : {
              id: `ai-${Date.now()}`,
              text: result.reply,
              sender: "ai",
            };

        setMessages((previous) => [
          ...previous.filter(
            (item) => item.id !== temporaryMessage.id,
          ),
          {
            ...temporaryMessage,
            id: result.userMessage.id,
            deliveryStatus: result.userMessage.delivery_status,
          },
          aiMessage,
        ]);

        // Generate a title from the first user message.
        const isFirstMessage = messages.every(
          (item) => item.id === "welcome",
        );

        if (isFirstMessage) {
          await generateConversationTitle(
            currentConversation,
            userId,
            trimmed,
          );

          await loadConversations(userId);
        }
      }
    } catch (error) {
      setMessages((previous) =>
        previous.map((item) =>
          item.id === temporaryMessage.id
            ? {
                ...item,
                deliveryStatus: "failed",
              }
            : item,
        ),
      );

      setErrorMessage(getErrorMessage(error));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [
    message,
    userId,
    conversationId,
    messages,
    loadConversations,
  ]);

  // --------------------------------------------------------------------------
  // VOICE INPUT
  // --------------------------------------------------------------------------

  const requestMicrophonePermission = useCallback(async () => {
    if (Platform.OS !== "android") {
      return true;
    }

    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );

    return permission === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const toggleVoiceInput = useCallback(async () => {
    setErrorMessage("");

    if (isListening) {
      try {
        await VoiceToText.stopListening();
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }

      return;
    }

    try {
      const permissionGranted =
        await requestMicrophonePermission();

      if (!permissionGranted) {
        setErrorMessage(
          "Microphone permission is required for voice input.",
        );
        return;
      }

      await VoiceToText.startListening({
        continuous: true,
      });
    } catch (error) {
      setIsListening(false);
      setErrorMessage(getErrorMessage(error));
    }
  }, [isListening, requestMicrophonePermission]);

  // --------------------------------------------------------------------------
  // TEXT TO SPEECH
  // --------------------------------------------------------------------------

  const speakMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    try {
      await Tts.stop();

      Tts.setDefaultLanguage("en-US");
      Tts.setDefaultRate(0.45);
      Tts.setDefaultPitch(1.0);

      Tts.speak(text);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    Tts.stop();
    setIsSpeaking(false);
  }, []);

  // --------------------------------------------------------------------------
  // JOURNAL: LOAD ENTRIES
  // --------------------------------------------------------------------------

  const loadJournal = useCallback(async () => {
    if (!userId) return;

    setLoadingJournal(true);

    try {
      const result = await getJournalEntries(userId);

      setJournalEntries(
        (result ?? []).map((entry: any) => ({
          id: entry.id,
          title: entry.title ?? "",
          content: entry.content ?? "",
          mood: entry.mood ?? "",
          tags: Array.isArray(entry.tags)
            ? entry.tags
            : [],
          createdAt:
            entry.createdAt ?? entry.created_at,
          updatedAt:
            entry.updatedAt ?? entry.updated_at,
        })),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoadingJournal(false);
    }
  }, [userId]);

  // --------------------------------------------------------------------------
  // JOURNAL: OPEN TAB
  // --------------------------------------------------------------------------

  const openJournal = useCallback(async () => {
    Keyboard.dismiss();

    setActiveTab("journal");
    setShowHistory(false);
    setJournalEditorVisible(false);

    if (!userId) {
      try {
        const uid = await loadAuthenticatedUser();
        setUserId(uid);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
        return;
      }
    }

    await loadJournal();
  }, [userId, loadAuthenticatedUser, loadJournal]);

  // --------------------------------------------------------------------------
  // JOURNAL: NEW ENTRY
  // --------------------------------------------------------------------------

  const newJournalEntry = useCallback(() => {
    setEditingJournalId(null);
    setJournalTitle("");
    setJournalContent("");
    setJournalMood("");
    setJournalEditorVisible(true);
  }, []);

  // --------------------------------------------------------------------------
  // JOURNAL: EDIT ENTRY
  // --------------------------------------------------------------------------

  const editJournalEntry = useCallback((entry: JournalItem) => {
    setEditingJournalId(entry.id);
    setJournalTitle(entry.title);
    setJournalContent(entry.content);
    setJournalMood(entry.mood ?? "");
    setJournalEditorVisible(true);
  }, []);

  // --------------------------------------------------------------------------
  // JOURNAL: SAVE ENTRY
  // --------------------------------------------------------------------------

  const saveJournal = useCallback(async () => {
    if (!userId) {
      setErrorMessage("Please sign in to save journal entries.");
      return;
    }

    const title = journalTitle.trim();
    const content = journalContent.trim();

    if (!content) {
      setErrorMessage("Write something before saving your journal entry.");
      return;
    }

    setSavingJournal(true);
    setErrorMessage("");

    try {
      if (editingJournalId) {
        await updateJournalEntry(
          editingJournalId,
          userId,
          {
            title: title || "My journal entry",
            content,
            mood: journalMood || undefined,
          },
        );
      } else {
        await createJournalEntry({
          userId,
          title: title || "My journal entry",
          content,
          mood: journalMood || undefined,
        });
      }

      setJournalEditorVisible(false);
      setEditingJournalId(null);

      setJournalTitle("");
      setJournalContent("");
      setJournalMood("");

      await loadJournal();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingJournal(false);
    }
  }, [
    userId,
    journalTitle,
    journalContent,
    journalMood,
    editingJournalId,
    loadJournal,
  ]);

  // --------------------------------------------------------------------------
  // JOURNAL: DELETE ENTRY
  // --------------------------------------------------------------------------

  const removeJournalEntry = useCallback(
    (entryId: string) => {
      if (!userId) return;

      Alert.alert(
        "Delete journal entry",
        "Are you sure you want to delete this journal entry?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteJournalEntry(entryId, userId);
                await loadJournal();
              } catch (error) {
                setErrorMessage(getErrorMessage(error));
              }
            },
          },
        ],
      );
    },
    [userId, loadJournal],
  );

  // --------------------------------------------------------------------------
  // JOURNAL: MOOD OPTIONS
  // --------------------------------------------------------------------------

  const journalMoods = [
    { value: "Very low", emoji: "😔" },
    { value: "Low", emoji: "😕" },
    { value: "Neutral", emoji: "😐" },
    { value: "Good", emoji: "🙂" },
    { value: "Very good", emoji: "😄" },
  ];

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <>
      {/* ================================================================== */}
      {/* FLOATING BUTTON */}
      {/* ================================================================== */}

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

        <View
          pointerEvents="none"
          style={styles.staticHalo}
        />

        <TouchableOpacity
          style={styles.fabTouchable}
          onPress={openChat}
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

        <View style={styles.statusOuter}>
          <View style={styles.statusDot} />
        </View>
      </Animated.View>

      {/* ================================================================== */}
      {/* CHAT MODAL */}
      {/* ================================================================== */}

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
                {/* ------------------------------------------------------ */}
                {/* HEADER */}
                {/* ------------------------------------------------------ */}

                <LinearGradient
                  colors={["#FFFFFF", "#F5FBF7"]}
                  style={styles.chatHeader}
                >
                  <View style={styles.headerLeft}>
                    <View style={styles.headerAvatarWrapper}>
                      <LinearGradient
                        colors={["#38D996", "#128453"]}
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
                  >
                    <X size={19} color="#64756A" />
                  </TouchableOpacity>
                </LinearGradient>

                {/* ------------------------------------------------------ */}
                {/* TAB SWITCHER */}
                {/* ------------------------------------------------------ */}

                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[
                      styles.tabButton,
                      activeTab === "chat" && styles.activeTab,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setActiveTab("chat");
                      setJournalEditorVisible(false);
                    }}
                  >
                    <MessageSquare
                      size={15}
                      color={
                        activeTab === "chat"
                          ? COLORS.green
                          : COLORS.muted
                      }
                    />

                    <Text
                      style={[
                        styles.tabText,
                        activeTab === "chat" && styles.activeTabText,
                      ]}
                    >
                      AI Companion
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tabButton,
                      activeTab === "journal" && styles.activeTab,
                    ]}
                    onPress={openJournal}
                  >
                    <BookHeart
                      size={15}
                      color={
                        activeTab === "journal"
                          ? COLORS.green
                          : COLORS.muted
                      }
                    />

                    <Text
                      style={[
                        styles.tabText,
                        activeTab === "journal" && styles.activeTabText,
                      ]}
                    >
                      My Journal
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ------------------------------------------------------ */}
                {/* CHAT CONTENT */}
                {/* ------------------------------------------------------ */}

                {activeTab === "chat" && (
                  <>
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

                      <TouchableOpacity
                        onPress={() => setShowHistory((value) => !value)}
                        style={styles.historyButton}
                      >
                        <Clock
                          size={15}
                          color={COLORS.green}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={startNewConversation}
                        style={styles.historyButton}
                      >
                        <Plus
                          size={17}
                          color={COLORS.green}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* HISTORY LIST */}

                    {showHistory ? (
                      <View style={styles.historyContainer}>
                        <Text style={styles.sectionTitle}>
                          Your conversations
                        </Text>

                        {loadingHistory ? (
                          <ActivityIndicator color={COLORS.green} />
                        ) : (
                          <FlatList
                            data={conversations}
                            keyExtractor={(item) => item.id}
                            ListEmptyComponent={
                              <Text style={styles.emptyText}>
                                No saved conversations yet.
                              </Text>
                            }
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={[
                                  styles.historyItem,
                                  item.id === conversationId &&
                                    styles.selectedHistoryItem,
                                ]}
                                onPress={() =>
                                  switchConversation(item.id)
                                }
                              >
                                <MessageCircle
                                  size={17}
                                  color={COLORS.green}
                                />

                                <View style={styles.historyItemText}>
                                  <Text
                                    style={styles.historyItemTitle}
                                    numberOfLines={1}
                                  >
                                    {item.title}
                                  </Text>

                                  <Text style={styles.historyDate}>
                                    {new Date(
                                      item.updated_at,
                                    ).toLocaleDateString()}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            )}
                          />
                        )}

                        <TouchableOpacity
                          style={styles.backToChatButton}
                          onPress={() => setShowHistory(false)}
                        >
                          <ChevronLeft
                            size={16}
                            color={COLORS.green}
                          />

                          <Text style={styles.backToChatText}>
                            Back to chat
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
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
                          ListEmptyComponent={
                            loadingMessages ? (
                              <View style={styles.loadingContainer}>
                                <ActivityIndicator
                                  color={COLORS.green}
                                  size="large"
                                />

                                <Text style={styles.loadingText}>
                                  Preparing your conversation...
                                </Text>
                              </View>
                            ) : null
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

                                {item.deliveryStatus === "failed" && (
                                  <Text style={styles.failedText}>
                                    Not delivered
                                  </Text>
                                )}

                                {item.sender === "ai" && (
                                  <TouchableOpacity
                                    style={styles.speakButton}
                                    onPress={() =>
                                      isSpeaking
                                        ? stopSpeaking()
                                        : speakMessage(item.text)
                                    }
                                  >
                                    {isSpeaking ? (
                                      <VolumeX
                                        size={15}
                                        color={COLORS.green}
                                      />
                                    ) : (
                                      <Volume2
                                        size={15}
                                        color={COLORS.green}
                                      />
                                    )}
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          )}
                        />

                        {/* THINKING INDICATOR */}

                        {sending && (
                          <View style={styles.typingIndicator}>
                            <ActivityIndicator
                              size="small"
                              color={COLORS.green}
                            />

                            <Text style={styles.typingText}>
                              Wellness AI is thinking...
                            </Text>
                          </View>
                        )}

                        {/* OFFLINE NOTICE */}

                        {!!offlineNotice && (
                          <View style={styles.offlineNotice}>
                            <WifiOff
                              size={14}
                              color="#8A7040"
                            />

                            <Text style={styles.offlineText}>
                              {offlineNotice}
                            </Text>
                          </View>
                        )}

                        {/* INPUT */}

                        <View style={styles.inputArea}>
                          {!!errorMessage && (
                            <Text style={styles.errorText}>
                              {errorMessage}
                            </Text>
                          )}

                          <View style={styles.inputContainer}>
                            <TextInput
                              value={message}
                              onChangeText={setMessage}
                              placeholder={
                                isListening
                                  ? "Listening..."
                                  : "Share what's on your mind..."
                              }
                              placeholderTextColor="#9AA99F"
                              style={styles.input}
                              multiline
                              maxLength={4000}
                              textAlignVertical="center"
                              accessibilityLabel="Chat message"
                            />

                            <TouchableOpacity
                              style={[
                                styles.voiceButton,
                                isListening && styles.voiceButtonActive,
                              ]}
                              onPress={toggleVoiceInput}
                              disabled={sending}
                              accessibilityLabel={
                                isListening
                                  ? "Stop voice input"
                                  : "Start voice input"
                              }
                            >
                              {isListening ? (
                                <MicOff
                                  size={18}
                                  color={COLORS.white}
                                />
                              ) : (
                                <Mic
                                  size={18}
                                  color={COLORS.green}
                                />
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.sendButton,
                                (!message.trim() || sending) &&
                                  styles.sendButtonDisabled,
                              ]}
                              onPress={sendMessage}
                              disabled={!message.trim() || sending}
                              accessibilityRole="button"
                              accessibilityLabel="Send message"
                            >
                              {sending ? (
                                <ActivityIndicator
                                  size="small"
                                  color={COLORS.white}
                                />
                              ) : (
                                <Send
                                  size={17}
                                  color={COLORS.white}
                                  strokeWidth={2.4}
                                />
                              )}
                            </TouchableOpacity>
                          </View>

                          <Text style={styles.inputFootnote}>
                            Your journal entries are separate from AI chat.
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* ------------------------------------------------------ */}
                {/* JOURNAL CONTENT */}
                {/* ------------------------------------------------------ */}

                {activeTab === "journal" && (
                  <View style={styles.journalContainer}>
                    {journalEditorVisible ? (
                      <ScrollView
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.journalEditor}
                      >
                        <View style={styles.journalEditorHeader}>
                          <TouchableOpacity
                            onPress={() =>
                              setJournalEditorVisible(false)
                            }
                            style={styles.backButton}
                          >
                            <ChevronLeft
                              size={19}
                              color={COLORS.green}
                            />

                            <Text style={styles.backButtonText}>
                              Back
                            </Text>
                          </TouchableOpacity>

                          <Text style={styles.sectionTitle}>
                            {editingJournalId
                              ? "Edit entry"
                              : "New journal entry"}
                          </Text>
                        </View>

                        <Text style={styles.fieldLabel}>
                          Title
                        </Text>

                        <TextInput
                          value={journalTitle}
                          onChangeText={setJournalTitle}
                          placeholder="Give your entry a title..."
                          placeholderTextColor="#9AA99F"
                          style={styles.journalTitleInput}
                          maxLength={100}
                        />

                        <Text style={styles.fieldLabel}>
                          How are you feeling?
                        </Text>

                        <View style={styles.moodOptions}>
                          {journalMoods.map((mood) => (
                            <TouchableOpacity
                              key={mood.value}
                              style={[
                                styles.moodOption,
                                journalMood === mood.value &&
                                  styles.selectedMoodOption,
                              ]}
                              onPress={() =>
                                setJournalMood(
                                  journalMood === mood.value
                                    ? ""
                                    : mood.value,
                                )
                              }
                            >
                              <Text style={styles.moodEmoji}>
                                {mood.emoji}
                              </Text>
                              <Text style={styles.moodLabel}>
                                {mood.value}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.fieldLabel}>
                          Your thoughts
                        </Text>

                        <TextInput
                          value={journalContent}
                          onChangeText={setJournalContent}
                          placeholder="Write freely. This is your private space..."
                          placeholderTextColor="#9AA99F"
                          style={styles.journalContentInput}
                          multiline
                          textAlignVertical="top"
                          maxLength={10000}
                        />

                        {!!errorMessage && (
                          <Text style={styles.errorText}>
                            {errorMessage}
                          </Text>
                        )}

                        <TouchableOpacity
                          style={[
                            styles.saveJournalButton,
                            savingJournal &&
                              styles.sendButtonDisabled,
                          ]}
                          onPress={saveJournal}
                          disabled={savingJournal}
                        >
                          {savingJournal ? (
                            <ActivityIndicator color={COLORS.white} />
                          ) : (
                            <>
                              <BookHeart
                                size={17}
                                color={COLORS.white}
                              />

                              <Text style={styles.saveJournalText}>
                                Save journal entry
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <Text style={styles.privateNotice}>
                          🔒 Your journal is kept separate from AI chat.
                        </Text>
                      </ScrollView>
                    ) : (
                      <>
                        <View style={styles.journalHeading}>
                          <View>
                            <Text style={styles.sectionTitle}>
                              Your private journal
                            </Text>

                            <Text style={styles.journalSubtitle}>
                              A space to reflect, grow and express yourself.
                            </Text>
                          </View>

                          <TouchableOpacity
                            style={styles.addJournalButton}
                            onPress={newJournalEntry}
                          >
                            <Plus
                              size={19}
                              color={COLORS.white}
                            />
                          </TouchableOpacity>
                        </View>

                        {loadingJournal ? (
                          <View style={styles.loadingContainer}>
                            <ActivityIndicator
                              color={COLORS.green}
                              size="large"
                            />

                            <Text style={styles.loadingText}>
                              Loading your journal...
                            </Text>
                          </View>
                        ) : (
                          <FlatList
                            data={journalEntries}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={
                              styles.journalList
                            }
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                              <View style={styles.emptyJournal}>
                                <View style={styles.emptyJournalIcon}>
                                  <BookHeart
                                    size={32}
                                    color={COLORS.green}
                                  />
                                </View>

                                <Text style={styles.emptyJournalTitle}>
                                  Your story starts here
                                </Text>

                                <Text style={styles.emptyJournalText}>
                                  Create your first journal entry and
                                  make space for your thoughts.
                                </Text>

                                <TouchableOpacity
                                  style={styles.emptyJournalButton}
                                  onPress={newJournalEntry}
                                >
                                  <Plus
                                    size={16}
                                    color={COLORS.white}
                                  />

                                  <Text style={styles.emptyJournalButtonText}>
                                    Write your first entry
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            }
                            renderItem={({ item }) => (
                              <View style={styles.journalCard}>
                                <View style={styles.journalCardHeader}>
                                  <View style={styles.journalCardIcon}>
                                    <BookHeart
                                      size={17}
                                      color={COLORS.green}
                                    />
                                  </View>

                                  <View style={styles.journalCardHeading}>
                                    <Text
                                      style={styles.journalCardTitle}
                                      numberOfLines={1}
                                    >
                                      {item.title || "My journal entry"}
                                    </Text>

                                    <Text style={styles.journalDate}>
                                      {getJournalDate(item)}
                                    </Text>
                                  </View>

                                  <TouchableOpacity
                                    style={styles.journalAction}
                                    onPress={() =>
                                      editJournalEntry(item)
                                    }
                                  >
                                    <Edit3
                                      size={16}
                                      color={COLORS.green}
                                    />
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.journalAction}
                                    onPress={() =>
                                      removeJournalEntry(item.id)
                                    }
                                  >
                                    <Trash2
                                      size={16}
                                      color={COLORS.red}
                                    />
                                  </TouchableOpacity>
                                </View>

                                {!!item.mood && (
                                  <Text style={styles.journalMood}>
                                    Feeling: {item.mood}
                                  </Text>
                                )}

                                <Text
                                  style={styles.journalPreview}
                                  numberOfLines={4}
                                >
                                  {item.content}
                                </Text>

                                <TouchableOpacity
                                  onPress={() =>
                                    editJournalEntry(item)
                                  }
                                >
                                  <Text style={styles.readEntryText}>
                                    Read and edit
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          />
                        )}
                      </>
                    )}
                  </View>
                )}
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // FLOATING BUTTON

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

  // MODAL

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
    height: SCREEN_HEIGHT * 0.68,
    maxHeight: 680,
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

  // HEADER

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

  // TABS

  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 9,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },

  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  activeTab: {
    borderBottomColor: COLORS.green,
  },

  tabText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },

  activeTabText: {
    color: COLORS.green,
    fontWeight: "800",
  },

  // WELCOME STRIP

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

  historyButton: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: "#DDF1E4",
    alignItems: "center",
    justifyContent: "center",
  },

  // MESSAGES

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

  speakButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    padding: 3,
  },

  failedText: {
    color: "#F5C4C4",
    fontSize: 10,
    marginTop: 5,
  },

  // INPUT

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

  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E2F2E8",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  voiceButtonActive: {
    backgroundColor: "#D9534F",
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
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

  // LOADING AND STATUS

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 10,
  },

  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },

  typingText: {
    fontSize: 11,
    color: COLORS.muted,
  },

  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "#FFF5DF",
  },

  offlineText: {
    fontSize: 10,
    color: "#8A7040",
    flex: 1,
  },

  errorText: {
    fontSize: 11,
    color: COLORS.red,
    marginBottom: 7,
    paddingHorizontal: 4,
  },

  // HISTORY

  historyContainer: {
    flex: 1,
    padding: 16,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },

  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  selectedHistoryItem: {
    borderColor: "#8BCBA5",
    backgroundColor: "#EFF8F2",
  },

  historyItemText: {
    flex: 1,
  },

  historyItemTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  historyDate: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 3,
  },

  backToChatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    marginTop: 8,
  },

  backToChatText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "700",
  },

  emptyText: {
    color: COLORS.muted,
    textAlign: "center",
    padding: 20,
  },

  // JOURNAL

  journalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  journalHeading: {
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  journalSubtitle: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 3,
    maxWidth: 240,
    lineHeight: 16,
  },

  addJournalButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
  },

  journalList: {
    paddingHorizontal: 13,
    paddingBottom: 20,
  },

  journalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 14,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  journalCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  journalCardIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: "#E5F4E9",
    alignItems: "center",
    justifyContent: "center",
  },

  journalCardHeading: {
    flex: 1,
  },

  journalCardTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "800",
  },

  journalDate: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 3,
  },

  journalAction: {
    padding: 6,
  },

  journalMood: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 10,
  },

  journalPreview: {
    color: "#617268",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },

  readEntryText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
  },

  emptyJournal: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
    paddingVertical: 35,
  },

  emptyJournalIcon: {
    width: 65,
    height: 65,
    borderRadius: 23,
    backgroundColor: "#E0F2E6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyJournalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  emptyJournalText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  emptyJournalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: COLORS.green,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 13,
    marginTop: 18,
  },

  emptyJournalButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },

  // JOURNAL EDITOR

  journalEditor: {
    padding: 16,
    paddingBottom: 25,
  },

  journalEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  backButtonText: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "700",
  },

  fieldLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 15,
    marginBottom: 8,
  },

  journalTitleInput: {
    backgroundColor: COLORS.white,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 13,
  },

  moodOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  moodOption: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 58,
  },

  selectedMoodOption: {
    backgroundColor: "#E3F5E9",
    borderColor: "#6BB88A",
  },

  moodEmoji: {
    fontSize: 20,
  },

  moodLabel: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 4,
  },

  journalContentInput: {
    minHeight: 150,
    maxHeight: 240,
    backgroundColor: COLORS.white,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
  },

  saveJournalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.green,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 18,
  },

  saveJournalText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },

  privateNotice: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: "center",
    marginTop: 12,
  },
});
