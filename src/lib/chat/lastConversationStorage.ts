/** localStorage 键：上次打开的会话 id（与 IndexedDB 同源校验）。 */
export const LAST_CONVERSATION_STORAGE_KEY = "llmira-last-conversation-id";

export function readSavedConversationId(): string | null {
  try {
    return localStorage.getItem(LAST_CONVERSATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSavedConversationId(id: string): void {
  try {
    localStorage.setItem(LAST_CONVERSATION_STORAGE_KEY, id);
  } catch {
    /* private mode / quota */
  }
}

export function clearSavedConversationId(): void {
  try {
    localStorage.removeItem(LAST_CONVERSATION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
