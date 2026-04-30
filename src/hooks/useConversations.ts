"use client";

/**
 * @project LLMira
 * @file src/hooks/useConversations.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - Dexie CRUD、加载消息（稳定排序）、搜索、导入导出入口
 * @description 与 `useChatStore` 同步消息列表；标题由首条用户消息推导。
 */
import { useCallback, useMemo } from "react";
import { bootstrapSessionFromIndexedDb } from "@/lib/chat/bootstrapSession";
import type { ExportedChat, ExportedFullBackup } from "@/lib/chat/exportImport";
import {
  buildFullBackupPayload,
  downloadJsonFile,
  stringifyFullBackup,
} from "@/lib/chat/exportImport";
import { db, type ConversationRecord } from "@/lib/db/dexie";
import { useChatStore } from "@/lib/store/chatStore";
import type { Conversation, ChatMessage } from "@/types";

function uid() {
  return crypto.randomUUID();
}

/**
 * 会话持久化与列表操作（Dexie），并与全局 chat store 同步。
 */
export function useConversations() {
  const { conversations, setConversations, activeConversationId, setActiveConversationId, setMessages } =
    useChatStore();

  const loadAll = useCallback(async () => {
    const list = await db.conversations.orderBy("updatedAt").reverse().toArray();
    setConversations(list);
    const current = useChatStore.getState().activeConversationId;
    if (!current && list[0]) setActiveConversationId(list[0].id);
  }, [setActiveConversationId, setConversations]);

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
        const next = rest[0]?.id ?? null;
        setActiveConversationId(next);
        if (next) await loadMessages(next);
      }
    },
    [activeConversationId, conversations, loadMessages, setActiveConversationId, setConversations],
  );

  const exportFullBackupDownload = useCallback(async () => {
    const convs = await db.conversations.orderBy("updatedAt").reverse().toArray();
    const allMsgs = await db.messages.toArray();
    const byConv: Record<string, ChatMessage[]> = {};
    for (const m of allMsgs) {
      const id = m.conversationId;
      if (!byConv[id]) byConv[id] = [];
      byConv[id].push(m);
    }
    for (const id of Object.keys(byConv)) {
      byConv[id].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    }
    const payload = buildFullBackupPayload(convs, byConv);
    downloadJsonFile(`llmira-full-backup-${Date.now()}.json`, stringifyFullBackup(payload));
  }, []);

  const importFullBackupMerge = useCallback(
    async (data: ExportedFullBackup) => {
      const prevActive = useChatStore.getState().activeConversationId;
      await db.transaction("rw", db.conversations, db.messages, async () => {
        for (const { conversation, messages } of data.chats) {
          const newId = uid();
          const now = Date.now();
          const record: ConversationRecord = {
            id: newId,
            title: (conversation.title || "导入的对话").slice(0, 40),
            model: conversation.model,
            createdAt: now,
            updatedAt: now,
            keyword: (conversation.title || "导入的对话").slice(0, 40),
          };
          await db.conversations.put(record);
          const payload = messages.map((m) => ({
            ...m,
            id: uid(),
            conversationId: newId,
          }));
          await db.messages.bulkPut(payload);
        }
      });
      await loadAll();
      const list = useChatStore.getState().conversations;
      if (prevActive && list.some((c) => c.id === prevActive)) {
        setActiveConversationId(prevActive);
        await loadMessages(prevActive);
      } else if (list[0]) {
        setActiveConversationId(list[0].id);
        await loadMessages(list[0].id);
      } else {
        setActiveConversationId(null);
      }
    },
    [loadAll, loadMessages, setActiveConversationId],
  );

  const importFullBackupReplace = useCallback(async (data: ExportedFullBackup) => {
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.conversations.clear();
      await db.messages.clear();
      for (const { conversation, messages } of data.chats) {
        const keyword = (conversation as ConversationRecord).keyword ?? conversation.title;
        await db.conversations.put({ ...conversation, keyword } as ConversationRecord);
        const payload = messages.map((m) => ({ ...m, conversationId: conversation.id }));
        await db.messages.bulkPut(payload);
      }
    });
    await bootstrapSessionFromIndexedDb();
  }, []);

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
      exportFullBackupDownload,
      importFullBackupMerge,
      importFullBackupReplace,
      setActiveConversationId,
    }),
    [
      activeConversationId,
      conversations,
      createConversation,
      importFromExport,
      exportFullBackupDownload,
      importFullBackupMerge,
      importFullBackupReplace,
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
