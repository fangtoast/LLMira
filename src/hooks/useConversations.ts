"use client";

import { useCallback, useMemo } from "react";
import { db } from "@/lib/db/dexie";
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
    const messages = await db.messages.where("conversationId").equals(conversationId).sortBy("createdAt");
    setMessages(conversationId, messages);
  }, [setMessages]);

  const saveMessages = useCallback(async (conversationId: string, messages: ChatMessage[]) => {
    const payload = messages.map((item) => ({ ...item, conversationId }));
    await db.transaction("rw", db.messages, db.conversations, async () => {
      await db.messages.where("conversationId").equals(conversationId).delete();
      await db.messages.bulkPut(payload);
      const title = messages.find((m) => m.role === "user")?.content.slice(0, 20) || "新对话";
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
    const all = await db.conversations.toArray();
    const filtered = all
      .filter((item) => item.title.toLowerCase().includes(keyword.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(filtered);
  }, [loadAll, setConversations]);

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
      setActiveConversationId,
    }),
    [
      activeConversationId,
      conversations,
      createConversation,
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
