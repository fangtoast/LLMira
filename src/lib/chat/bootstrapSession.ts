import { db } from "@/lib/db/dexie";
import { useChatStore } from "@/lib/store/chatStore";
import { readSavedConversationId } from "@/lib/chat/lastConversationStorage";

/**
 * 从 IndexedDB 一次性灌入会话列表、恢复上次活跃会话并加载其消息；最后标记 hydrated。
 */
export async function bootstrapSessionFromIndexedDb(): Promise<void> {
  const store = useChatStore.getState();
  store.setHydrated(false);
  try {
    const list = await db.conversations.orderBy("updatedAt").reverse().toArray();
    store.setConversations(list);

    let active: string | null = null;
    const saved = readSavedConversationId();
    if (saved && list.some((c) => c.id === saved)) active = saved;
    else if (list[0]) active = list[0].id;

    store.setActiveConversationId(active);
    if (active) {
      const messages = await db.messages.where("conversationId").equals(active).toArray();
      messages.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      store.setMessages(active, messages);
    } else {
      useChatStore.setState({ messagesByConversation: {} });
    }
  } finally {
    store.setHydrated(true);
  }
}
