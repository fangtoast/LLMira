"use client";

import { create } from "zustand";
import type { ChatMessage, Conversation, TokenUsage } from "@/types";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, ChatMessage[]>;
  loading: boolean;
  lastTokenUsage?: TokenUsage;
  /** 对话区顶部的可清除提示（如网络/鉴权） */
  clientNotice: string | null;
  setClientNotice: (v: string | null) => void;
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

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messagesByConversation: {},
  loading: false,
  clientNotice: null,
  setClientNotice: (clientNotice) => set({ clientNotice }),
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
