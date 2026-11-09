
// src/services/journalService.ts

import {
  getDatabase,
  initializeDatabase,
} from "../database/database";

type SqlRow = Record<string, any>;

export type JournalEntry = {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: string | null;
  tags: string[];
  prompt: string | null;
  isPrivate: true;
  createdAt: string;
  updatedAt: string;
};

export type CreateJournalEntryOptions = {
  userId: string;
  title?: string;
  content: string;
  mood?: string | null;
  tags?: string[];
  prompt?: string | null;
};

export type UpdateJournalEntryOptions = {
  title?: string;
  content?: string;
  mood?: string | null;
  tags?: string[];
  prompt?: string | null;
};

export type GetJournalEntriesOptions = {
  limit?: number;
  offset?: number;
  search?: string;
  mood?: string;
};

function createId(): string {
  return `journal_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string",
    );
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
  } catch {
    // Support older entries that may contain comma-separated tags.
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}

function mapJournalRow(row: SqlRow): JournalEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    mood: row.mood == null ? null : String(row.mood),
    tags: parseTags(row.tags),
    prompt: row.prompt == null ? null : String(row.prompt),
    isPrivate: true,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function prepareDatabase() {
  await initializeDatabase();
  return getDatabase();
}

/**
 * Create a private journal entry.
 *
 * Entries are stored locally. This service does not add them
 * to sync_queue and does not upload them to Gemini.
 */
export async function createJournalEntry(
  options: CreateJournalEntryOptions,
): Promise<JournalEntry> {
  const userId = options.userId.trim();
  const content = options.content.trim();

  if (!userId) {
    throw new Error("A user ID is required.");
  }

  if (!content) {
    throw new Error("Your journal entry cannot be empty.");
  }

  const db = await prepareDatabase();

  const now = new Date().toISOString();
  const id = createId();
  const title = options.title?.trim() || "My journal entry";
  const tags = JSON.stringify(
    (options.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean),
  );

  await db.execute(
    `INSERT INTO journal_entries (
      id,
      user_id,
      title,
      content,
      mood,
      tags,
      prompt,
      is_private,
      created_at,
      updated_at,
      synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)`,
    [
      id,
      userId,
      title,
      content,
      options.mood?.trim() || null,
      tags,
      options.prompt?.trim() || null,
      now,
      now,
    ],
  );

  const entry = await getJournalEntry(id, userId);

  if (!entry) {
    throw new Error("The journal entry was saved but could not be loaded.");
  }

  return entry;
}

/**
 * Get one journal entry belonging to the current user.
 */
export async function getJournalEntry(
  entryId: string,
  userId: string,
): Promise<JournalEntry | null> {
  const db = await prepareDatabase();

  const result = await db.execute<SqlRow>(
    `SELECT
      id,
      user_id,
      title,
      content,
      mood,
      tags,
      prompt,
      is_private,
      created_at,
      updated_at
    FROM journal_entries
    WHERE id = ? AND user_id = ?
    LIMIT 1`,
    [entryId, userId],
  );

  const row = result.rows._array[0];

  return row ? mapJournalRow(row) : null;
}

/**
 * Get the current user's journal entries.
 */
export async function getJournalEntries(
  userId: string,
  options: GetJournalEntriesOptions = {},
): Promise<JournalEntry[]> {
  if (!userId.trim()) {
    return [];
  }

  const db = await prepareDatabase();

  const limit = Math.min(
    Math.max(Math.floor(options.limit ?? 50), 1),
    200,
  );

  const offset = Math.max(
    Math.floor(options.offset ?? 0),
    0,
  );

  const conditions = ["user_id = ?", "is_private = 1"];
  const params: (string | number)[] = [userId];

  if (options.mood?.trim()) {
    conditions.push("mood = ?");
    params.push(options.mood.trim());
  }

  if (options.search?.trim()) {
    conditions.push("(title LIKE ? OR content LIKE ?)");
    const searchTerm = `%${options.search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  params.push(limit, offset);

  const result = await db.execute<SqlRow>(
    `SELECT
      id,
      user_id,
      title,
      content,
      mood,
      tags,
      prompt,
      is_private,
      created_at,
      updated_at
    FROM journal_entries
    WHERE ${conditions.join(" AND ")}
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?`,
    params,
  );

  return result.rows._array.map(mapJournalRow);
}

/**
 * Update a private journal entry.
 */
export async function updateJournalEntry(
  entryId: string,
  userId: string,
  updates: UpdateJournalEntryOptions,
): Promise<JournalEntry> {
  const db = await prepareDatabase();

  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.title !== undefined) {
    const title = updates.title.trim();

    if (!title) {
      throw new Error("The journal title cannot be empty.");
    }

    fields.push("title = ?");
    params.push(title);
  }

  if (updates.content !== undefined) {
    const content = updates.content.trim();

    if (!content) {
      throw new Error("The journal entry cannot be empty.");
    }

    fields.push("content = ?");
    params.push(content);
  }

  if (updates.mood !== undefined) {
    fields.push("mood = ?");
    params.push(updates.mood?.trim() || null);
  }

  if (updates.tags !== undefined) {
    const tags = updates.tags
      .map((tag) => tag.trim())
      .filter(Boolean);

    fields.push("tags = ?");
    params.push(JSON.stringify(tags));
  }

  if (updates.prompt !== undefined) {
    fields.push("prompt = ?");
    params.push(updates.prompt?.trim() || null);
  }

  if (fields.length === 0) {
    const existing = await getJournalEntry(entryId, userId);

    if (!existing) {
      throw new Error("Journal entry not found.");
    }

    return existing;
  }

  fields.push("updated_at = ?");
  params.push(new Date().toISOString());

  params.push(entryId, userId);

  await db.execute(
    `UPDATE journal_entries
     SET ${fields.join(", ")}
     WHERE id = ? AND user_id = ? AND is_private = 1`,
    params,
  );

  const updated = await getJournalEntry(entryId, userId);

  if (!updated) {
    throw new Error("Journal entry not found or could not be updated.");
  }

  return updated;
}

/**
 * Delete one private journal entry belonging to the current user.
 */
export async function deleteJournalEntry(
  entryId: string,
  userId: string,
): Promise<void> {
  const db = await prepareDatabase();

  await db.execute(
    `DELETE FROM journal_entries
     WHERE id = ? AND user_id = ? AND is_private = 1`,
    [entryId, userId],
  );
}

/**
 * Delete all private journal entries for one user.
 */
export async function deleteAllJournalEntries(
  userId: string,
): Promise<void> {
  if (!userId.trim()) {
    throw new Error("A user ID is required.");
  }

  const db = await prepareDatabase();

  await db.execute(
    `DELETE FROM journal_entries
     WHERE user_id = ? AND is_private = 1`,
    [userId],
  );
}
