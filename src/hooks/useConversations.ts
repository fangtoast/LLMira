"use client";

import { useCallback, useMemo } from "react";
import type { ExportedChat } from "@/lib/chat/exportImport";
import { db, type ConversationRecord } from "@/lib/db/dexie";
import { useChatStore } from "@/lib/store/chatStore";
import type { Conversation, ChatMessage } from "@/types";

function uid() {
  return crypto.randomUUID();
}

export function useConversations() {
  const { conversations, setConversations, activeConversationId, setActiveConversationId, setMessages } =
    useChatStore();

  const loadAll = useCallback(async () => {
    const list = await db.conversations.orderBy("updatedAt").reverse().toArray();
    setConversations(list);
    if (!activeConversationId && list[0]) setActiveConversationId(list[0].id);
  }, [activeConversationId, setActiveConversationId, setConversations]);

  const createConversation = useCallback(async (model: string) => {
    const now = Date.now();
    const record: Conversation = {
      id: uid(),
      title: "新对话",
      model,
      createdAt: now,
      updatedAt: now,
    };
    await db.conversations.put(record);
    setConversations([record, ...conversations]);
    setActiveConversationId(record.id);
    return record.id;
  }, [conversations, setActiveConversationId, setConversations]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const messages = await db.messages.where("conversationId").equals(conversationId).toArray();
    messages.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    setMessages(conversationId, messages);
  }, [setMessages]);

  const saveMessages = useCallback(async (conversationId: string, messages: ChatMessage[]) => {
    const payload = messages.map((item) => ({ ...item, conversationId }));
    await db.transaction("rw", db.messages, db.conversations, async () => {
      await db.messages.where("conversationId").equals(conversationId).delete();
      await db.messages.bulkPut(payload);
      const firstUser = messages.find((m) => m.role === "user")?.content ?? "";
      const title =
        firstUser
          .replace(/^#+\s*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 28) || "新对话";
      await db.conversations.update(conversationId, { title, updatedAt: Date.now(), keyword: title });
    });
  }, []);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    await db.conversations.update(conversationId, { title, keyword: title, updatedAt: Date.now() });
    await loadAll();
  }, [loadAll]);

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      await db.transaction("rw", db.conversations, db.messages, async () => {
        await db.conversations.delete(conversationId);
        await db.messages.where("conversationId").equals(conversationId).delete();
      });

      const rest = conversations.filter((item) => item.id !== conversationId);
      setConversations(rest);

      if (activeConversationId === conversationId) {
        setActiveConversationId(rest[0]?.id ?? null);
      }
    },
    [activeConversationId, conversations, setActiveConversationId, setConversations],
  );

  const searchConversations = useCallback(async (keyword: string) => {
    if (!keyword.trim()) return loadAll();
    const q = keyword.toLowerCase();
    const all = await db.conversations.toArray();
    const fromTitle = all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || ((item as { keyword?: string }).keyword?.toLowerCase() ?? "").includes(q),
    );
    const fromTitleIds = new Set(fromTitle.map((c) => c.id));
    const allMsg = await db.messages.toArray();
    const fromBodyIds = new Set(
      allMsg.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.conversationId),
    );
    const map = new Map<string, (typeof all)[0]>();
    for (const c of all) {
      if (fromTitleIds.has(c.id) || fromBodyIds.has(c.id)) map.set(c.id, c);
    }
    setConversations([...map.values()].sort((a, b) => b.updatedAt - a.updatedAt));
  }, [loadAll, setConversations]);

  const importFromExport = useCallback(
    async (data: ExportedChat) => {
      const newId = uid();
      const now = Date.now();
      const record: Conversation = {
        id: newId,
        title: (data.conversation.title || "导入的对话").slice(0, 40),
        model: data.conversation.model,
        createdAt: now,
        updatedAt: now,
      };
      const msgs: ChatMessage[] = data.messages.map((m) => ({ ...m, id: uid() }));
      await db.transaction("rw", db.conversations, db.messages, async () => {
        await db.conversations.put({ ...record, keyword: record.title } as ConversationRecord);
        const payload = msgs.map((m) => ({ ...m, conversationId: newId }));
        await db.messages.bulkPut(payload);
      });
      setConversations([record, ...conversations]);
      setActiveConversationId(newId);
      setMessages(newId, msgs);
    },
    [conversations, setActiveConversationId, setConversations, setMessages],
  );

  return useMemo(
    () => ({
      conversations,
      activeConversationId,
      loadAll,
      createConversation,
      loadMessages,
      saveMessages,
      renameConversation,
      deleteConversation,
      searchConversations,
      importFromExport,
      setActiveConversationId,
    }),
    [
      activeConversationId,
      conversations,
      createConversation,
      importFromExport,
      loadAll,
      loadMessages,
      renameConversation,
      deleteConversation,
      saveMessages,
      searchConversations,
      setActiveConversationId,
    ],
  );
}
