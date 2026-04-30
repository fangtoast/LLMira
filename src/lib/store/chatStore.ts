"use client";

/**
 * @project LLMira
 * @file src/lib/store/chatStore.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 当前会话列表、按会话存消息、流式补丁与加载态
 * @description 与 Dexie 通过 `useConversations` 同步；不做持久化本身。
 */
import { create } from "zustand";
import type { ChatMessage, Conversation, TokenUsage } from "@/types";
import { clearSavedConversationId, writeSavedConversationId } from "@/lib/chat/lastConversationStorage";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, ChatMessage[]>;
  /** IndexedDB 引导完成后为 true，此前勿根据内存状态清空「上次会话」缓存 */
  hydrated: boolean;
  loading: boolean;
  lastTokenUsage?: TokenUsage;
  /** 对话区顶部的可清除提示（如网络/鉴权） */
  clientNotice: string | null;
  setClientNotice: (v: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  patchAssistantMessage: (
    conversationId: string,
    messageId: string,
    patch: { content?: string; thinkingContent?: string },
  ) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    patch: Partial<Pick<ChatMessage, "content" | "thinkingContent" | "imageUrls" | "generatedImageUrls" | "tokenUsage">>,
  ) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  replaceMessages: (conversationId: string, messages: ChatMessage[]) => void;
  setLoading: (loading: boolean) => void;
  setLastTokenUsage: (usage?: TokenUsage) => void;
}

/** 对话运行时状态（内存）；活跃会话 id 与每条会话的消息数组。 */
export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messagesByConversation: {},
  hydrated: false,
  loading: false,
  clientNotice: null,
  setClientNotice: (clientNotice) => set({ clientNotice }),
  setHydrated: (hydrated) => set({ hydrated }),
  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
    })),
  addMessage: (conversationId, message) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...(state.messagesByConversation[conversationId] ?? []), message],
      },
    })),
  patchAssistantMessage: (conversationId, messageId, patch) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((item) =>
          item.id === messageId ? { ...item, ...patch } : item,
        ),
      },
    })),
  updateMessage: (conversationId, messageId, patch) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).map((item) =>
          item.id === messageId ? { ...item, ...patch } : item,
        ),
      },
    })),
  deleteMessage: (conversationId, messageId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).filter((m) => m.id !== messageId),
      },
    })),
  replaceMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
    })),
  setLoading: (loading) => set({ loading }),
  setLastTokenUsage: (lastTokenUsage) => set({ lastTokenUsage }),
}));

useChatStore.subscribe((state) => {
  if (!state.hydrated) return;
  if (state.activeConversationId) writeSavedConversationId(state.activeConversationId);
  else clearSavedConversationId();
});
