"use client";

import { create } from "zustand";
import type { ChatMessage, Conversation, TokenUsage } from "@/types";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, ChatMessage[]>;
  loading: boolean;
  lastTokenUsage?: TokenUsage;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  patchAssistantMessage: (
    conversationId: string,
    messageId: string,
    patch: { content?: string; thinkingContent?: string },
  ) => void;
  setLoading: (loading: boolean) => void;
  setLastTokenUsage: (usage?: TokenUsage) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messagesByConversation: {},
  loading: false,
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
  setLoading: (loading) => set({ loading }),
  setLastTokenUsage: (lastTokenUsage) => set({ lastTokenUsage }),
}));
