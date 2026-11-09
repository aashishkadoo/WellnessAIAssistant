
// src/services/aiChatService.ts

import NetInfo from "@react-native-community/netinfo";

import { supabase } from "../lib/supabase";

import {
  saveChatMessage,
  getRecentChatHistory,
  updateMessageDeliveryStatus,
  type ChatMessage,
} from "./aiChatStorage";

import { getWellnessContextSafely } from "./wellnessContextService";

export type SendAIChatMessageOptions = {
  conversationId: string;
  message: string;
};

export type SendAIChatMessageResult = {
  conversationId: string;
  userMessage: ChatMessage;
  aiMessage: ChatMessage | null;
  reply: string | null;
  offline: boolean;
};

type WellnessChatResponse = {
  reply?: string;
  model?: string;
  userId?: string;
};

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;

/**
 * Sends a message to the Wellness AI Edge Function.
 *
 * Messages are first stored locally. If the device is offline,
 * the user's message remains in SQLite with pending status.
 *
 * Journal entries are deliberately excluded from this request.
 */
export async function sendAIChatMessage(
  options: SendAIChatMessageOptions,
): Promise<SendAIChatMessageResult> {
  const conversationId = options.conversationId;
  const message = options.message.trim();

  if (!conversationId) {
    throw new Error("A conversation ID is required.");
  }

  if (!message) {
    throw new Error("Please enter a message.");
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Your message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    );
  }

  // Get the persisted session. This can still be available offline.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Please sign in to use Wellness AI.");
  }

  // Read previous messages before saving the new user message.
  const history = await getRecentChatHistory(
    conversationId,
    userId,
    MAX_HISTORY_MESSAGES,
  );

  // Save immediately so the message is not lost if the request fails.
  const userMessage = await saveChatMessage({
    conversationId,
    userId,
    sender: "user",
    content: message,
    deliveryStatus: "pending",
  });

  try {
    const network = await NetInfo.fetch();

    if (
      network.isConnected === false ||
      network.isInternetReachable === false
    ) {
      return {
        conversationId,
        userMessage,
        aiMessage: null,
        reply: null,
        offline: true,
      };
    }

    // Only compact wellness summaries are shared with Gemini.
    // Journal entries and their contents are never included.
    const wellnessContext =
      await getWellnessContextSafely(userId);

    const { data, error } =
      await supabase.functions.invoke<WellnessChatResponse>(
        "wellness-chat",
        {
          body: {
            message,
            history,
            wellnessContext,
          },
        },
      );

    if (error) {
      throw new Error(
        error.message || "The Wellness AI service could not respond.",
      );
    }

    const reply =
      typeof data?.reply === "string"
        ? data.reply.trim()
        : "";

    if (!reply) {
      throw new Error(
        "The AI service returned an empty response. Please try again.",
      );
    }

    await updateMessageDeliveryStatus(
      userMessage.id,
      userId,
      "sent",
    );

    const aiMessage = await saveChatMessage({
      conversationId,
      userId,
      sender: "ai",
      content: reply,
      deliveryStatus: "saved",
      metadata: data?.model
        ? { model: data.model }
        : null,
    });

    return {
      conversationId,
      userMessage: {
        ...userMessage,
        delivery_status: "sent",
      },
      aiMessage,
      reply,
      offline: false,
    };
  } catch (error) {
    // Preserve the user's message locally for later retry.
    try {
      await updateMessageDeliveryStatus(
        userMessage.id,
        userId,
        "failed",
      );
    } catch {
      // Preserve the original request error.
    }

    throw error instanceof Error
      ? error
      : new Error("Something went wrong while contacting Wellness AI.");
  }
}

/**
 * Checks whether the device currently has network connectivity.
 */
export async function isAIChatOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();

    return (
      state.isConnected !== false &&
      state.isInternetReachable !== false
    );
  } catch {
    return false;
  }
}
