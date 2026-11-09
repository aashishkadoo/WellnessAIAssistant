// src/services/aiChatStorage.ts
import {
  getDatabase,
  initializeDatabase,
} from "../database/database";

// ============================================================================
// TYPES
// ============================================================================

export type ChatSender = "user" | "ai";

export type ChatDeliveryStatus =
  | "saved"
  | "pending"
  | "sent"
  | "failed";

export interface ChatConversation {
  [key: string]: any;

  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  is_archived: number;
}

export interface ChatMessage {
  [key: string]: any;

  id: string;
  conversation_id: string;
  user_id: string;
  sender: ChatSender;
  content: string;
  created_at: string;
  delivery_status: ChatDeliveryStatus;
  metadata: string | null;
}


export interface CreateConversationOptions {
  title?: string;
}

export interface SaveMessageOptions {
  conversationId: string;
  userId: string;
  sender: ChatSender;
  content: string;
  deliveryStatus?: ChatDeliveryStatus;
  metadata?: Record<string, unknown> | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generates a unique ID without requiring an additional UUID package.
 */
function generateId(): string {
  return `chat_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function getNow(): string {
  return new Date().toISOString();
}

function cleanText(value: string): string {
  return value.trim();
}

function parseMetadata(
  value: string | null,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
}

function mapMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    metadata: message.metadata,
  };
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

async function getReadyDatabase() {
  await initializeDatabase();
  return getDatabase();
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Creates a new conversation for the authenticated user.
 */
export async function createConversation(
  userId: string,
  options: CreateConversationOptions = {},
): Promise<ChatConversation> {
  if (!userId?.trim()) {
    throw new Error("A valid user ID is required.");
  }

  const db = await getReadyDatabase();

  const id = generateId();
  const now = getNow();

  const title =
    cleanText(options.title ?? "") || "New conversation";

  await db.execute(
    `INSERT INTO ai_chat_conversations (
      id,
      user_id,
      title,
      created_at,
      updated_at,
      last_message_at,
      is_archived
    ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [id, userId, title, now, now, null],
  );

  return {
    id,
    user_id: userId,
    title,
    created_at: now,
    updated_at: now,
    last_message_at: null,
    is_archived: 0,
  };
}

/**
 * Retrieves all non-archived conversations belonging to a user.
 */
export async function getConversations(
  userId: string,
): Promise<ChatConversation[]> {
  if (!userId?.trim()) {
    return [];
  }

  const db = await getReadyDatabase();

  const result = await db.execute<ChatConversation>(
    `SELECT
      id,
      user_id,
      title,
      created_at,
      updated_at,
      last_message_at,
      is_archived
    FROM ai_chat_conversations
    WHERE user_id = ?
      AND is_archived = 0
    ORDER BY
      COALESCE(last_message_at, updated_at) DESC`,
    [userId],
  );

  return result.rows?._array ?? [];
}

/**
 * Retrieves one conversation, ensuring it belongs to the user.
 */
export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<ChatConversation | null> {
  if (!conversationId || !userId) {
    return null;
  }

  const db = await getReadyDatabase();

  const result = await db.execute<ChatConversation>(
    `SELECT
      id,
      user_id,
      title,
      created_at,
      updated_at,
      last_message_at,
      is_archived
    FROM ai_chat_conversations
    WHERE id = ?
      AND user_id = ?
    LIMIT 1`,
    [conversationId, userId],
  );

  return result.rows?._array?.[0] ?? null;
}

/**
 * Updates the conversation title.
 */
export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string,
): Promise<void> {
  const cleanedTitle = cleanText(title);

  if (!conversationId || !userId || !cleanedTitle) {
    throw new Error("Conversation ID, user ID and title are required.");
  }

  const db = await getReadyDatabase();

  await db.execute(
    `UPDATE ai_chat_conversations
     SET title = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [cleanedTitle, getNow(), conversationId, userId],
  );
}

/**
 * Archives a conversation without deleting its messages.
 */
export async function archiveConversation(
  conversationId: string,
  userId: string,
): Promise<void> {
  if (!conversationId || !userId) {
    return;
  }

  const db = await getReadyDatabase();

  await db.execute(
    `UPDATE ai_chat_conversations
     SET is_archived = 1,
         updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [getNow(), conversationId, userId],
  );
}

/**
 * Permanently deletes a conversation and its messages.
 * Both deletes are scoped to the authenticated user.
 */
export async function deleteConversation(
  conversationId: string,
  userId: string,
): Promise<void> {
  if (!conversationId || !userId) {
    throw new Error("Conversation ID and user ID are required.");
  }

  const db = await getReadyDatabase();

  await db.execute(
    `DELETE FROM ai_chat_messages
     WHERE conversation_id = ?
       AND user_id = ?`,
    [conversationId, userId],
  );

  await db.execute(
    `DELETE FROM ai_chat_conversations
     WHERE id = ?
       AND user_id = ?`,
    [conversationId, userId],
  );
}

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * Saves a message locally.
 */
export async function saveChatMessage(
  options: SaveMessageOptions,
): Promise<ChatMessage> {
  const {
    conversationId,
    userId,
    sender,
    content,
    deliveryStatus = "saved",
    metadata = null,
  } = options;

  const cleanedContent = cleanText(content);

  if (!conversationId || !userId || !cleanedContent) {
    throw new Error(
      "Conversation ID, user ID and message content are required.",
    );
  }

  if (sender !== "user" && sender !== "ai") {
    throw new Error("Invalid chat message sender.");
  }

  const db = await getReadyDatabase();

  // Confirm that the conversation belongs to this user.
  const conversation = await getConversation(
    conversationId,
    userId,
  );

  if (!conversation) {
    throw new Error("Conversation was not found.");
  }

  const id = generateId();
  const now = getNow();

  const metadataJson = metadata
    ? JSON.stringify(metadata)
    : null;

  await db.execute(
    `INSERT INTO ai_chat_messages (
      id,
      conversation_id,
      user_id,
      sender,
      content,
      created_at,
      delivery_status,
      metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      conversationId,
      userId,
      sender,
      cleanedContent,
      now,
      deliveryStatus,
      metadataJson,
    ],
  );

  await db.execute(
    `UPDATE ai_chat_conversations
     SET updated_at = ?,
         last_message_at = ?
     WHERE id = ?
       AND user_id = ?`,
    [now, now, conversationId, userId],
  );

  return {
    id,
    conversation_id: conversationId,
    user_id: userId,
    sender,
    content: cleanedContent,
    created_at: now,
    delivery_status: deliveryStatus,
    metadata: metadataJson,
  };
}

/**
 * Loads messages from a conversation in chronological order.
 */
export async function getChatMessages(
  conversationId: string,
  userId: string,
  limit = 200,
): Promise<ChatMessage[]> {
  if (!conversationId || !userId) {
    return [];
  }

  const db = await getReadyDatabase();

  const safeLimit = Math.max(
    1,
    Math.min(Math.floor(limit), 500),
  );

  // Check ownership before retrieving messages.
  const conversation = await getConversation(
    conversationId,
    userId,
  );

  if (!conversation) {
    return [];
  }

  const result = await db.execute<ChatMessage>(
    `SELECT
      id,
      conversation_id,
      user_id,
      sender,
      content,
      created_at,
      delivery_status,
      metadata
    FROM ai_chat_messages
    WHERE conversation_id = ?
      AND user_id = ?
    ORDER BY created_at DESC
    LIMIT ?`,
    [conversationId, userId, safeLimit],
  );

  return (result.rows?._array ?? [])
    .reverse()
    .map(mapMessage);
}

/**
 * Updates delivery status after a Gemini request succeeds or fails.
 */
export async function updateMessageDeliveryStatus(
  messageId: string,
  userId: string,
  status: ChatDeliveryStatus,
): Promise<void> {
  if (!messageId || !userId) {
    return;
  }

  const db = await getReadyDatabase();

  await db.execute(
    `UPDATE ai_chat_messages
     SET delivery_status = ?
     WHERE id = ?
       AND user_id = ?`,
    [status, messageId, userId],
  );
}

/**
 * Deletes an individual message.
 */
export async function deleteChatMessage(
  messageId: string,
  userId: string,
): Promise<void> {
  if (!messageId || !userId) {
    return;
  }

  const db = await getReadyDatabase();

  await db.execute(
    `DELETE FROM ai_chat_messages
     WHERE id = ?
       AND user_id = ?`,
    [messageId, userId],
  );
}

// ============================================================================
// CHAT HISTORY FOR GEMINI
// ============================================================================

/**
 * Returns recent messages in the format expected by the Edge Function.
 * Journal entries are never read or included here.
 */
export async function getRecentChatHistory(
  conversationId: string,
  userId: string,
  limit = 12,
): Promise<
  Array<{
    sender: ChatSender;
    content: string;
  }>
> {
  const messages = await getChatMessages(
    conversationId,
    userId,
    limit,
  );

  return messages.map((message) => ({
    sender: message.sender,
    content: message.content,
  }));
}

// ============================================================================
// CONVERSATION TITLE GENERATION
// ============================================================================

/**
 * Uses the first user message as a simple conversation title.
 */
export async function generateConversationTitle(
  conversationId: string,
  userId: string,
  firstMessage: string,
): Promise<void> {
  const cleaned = cleanText(firstMessage);

  if (!cleaned) {
    return;
  }

  const title =
    cleaned.length > 42
      ? `${cleaned.slice(0, 39).trim()}...`
      : cleaned;

  await updateConversationTitle(
    conversationId,
    userId,
    title,
  );
}
