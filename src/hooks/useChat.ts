"use client";

/**
 * @project LLMira
 * @file src/hooks/useChat.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 发送消息、流式/图生、重试、编辑重发、删除
 * @description 编排 `useChatStore`、`useConversations` 与 `lib/api/client`；会话切换时中止流。
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { buildApiMessagesFromChat } from "@/lib/chat/buildMessages";
import { DEFAULT_STREAM_TIMEOUT_MS, generateImage, streamChatCompletion, type ApiRequestProfile } from "@/lib/api/client";
import type { StreamAbortReason } from "@/lib/api/types";
import { useChatStore } from "@/lib/store/chatStore";
import { useSettingsStore, type ModelGenerationSettings } from "@/lib/store/settingsStore";
import { useConversations } from "./useConversations";
import type { ChatAttachment, ChatMessage, ChatMessageVariant } from "@/types";

function uid() {
  return crypto.randomUUID();
}

type SendPayload = { text: string; attachments?: ChatAttachment[] };

const FALLBACK_MODEL_SETTINGS: ModelGenerationSettings = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  presencePenalty: 0,
  frequencyPenalty: 0,
};

function isAbortError(e: unknown): boolean {
  if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "AbortError") return true;
  return false;
}

function isImageModel(modelName?: string): boolean {
  if (!modelName) return false;
  return /(image|mj|dall|flux|sd|gpt-image)/i.test(modelName);
}

/**
 * 聊天发送与生成编排入口。
 *
 * @remarks 返回对象包含 `sendMessage`、`loading`、`stopGeneration` 等，供页面与输入条绑定。
 */
export function useChat() {
  const {
    userName,
    userAvatarText,
    setApiKeyModalOpen,
  } = useSettingsStore();
  const {
    activeConversationId,
    messagesByConversation,
    addMessage,
    patchAssistantMessage,
    updateMessage,
    replaceMessages,
    setLoading,
    loading,
    setLastTokenUsage,
    setClientNotice,
  } = useChatStore();
  const { createConversation, saveMessages } = useConversations();
  const streamAbortRef = useRef<AbortController | null>(null);
  /** 用户点击停止与切换会话都会 `abort`，用此区分文案。 */
  const streamUserAbortKindRef = useRef<"stop" | "conversation-switch" | null>(null);
  const sendLockRef = useRef(false);
  const prevConvId = useRef<string | null | undefined>(undefined);
  const lastUserPayloadRef = useRef<SendPayload | null>(null);

  useEffect(() => {
    if (prevConvId.current !== undefined && prevConvId.current !== activeConversationId) {
      streamUserAbortKindRef.current = "conversation-switch";
      streamAbortRef.current?.abort();
    }
    prevConvId.current = activeConversationId;
  }, [activeConversationId]);

  const buildFriendlyError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "未知错误";
    const lower = message.toLowerCase();
    if (
      lower.includes("context_length") ||
      lower.includes("context length") ||
      (lower.includes("invalid_request_error") && lower.includes("context")) ||
      (lower.includes("context") &&
        (lower.includes("token") || lower.includes("limit") || lower.includes("exceed"))) ||
      lower.includes("maximum context") ||
      lower.includes("token limit") ||
      lower.includes("too many tokens") ||
      lower.includes("prompt is too long") ||
      lower.includes("input is too long") ||
      lower.includes("requested token count exceeds")
    ) {
      return "提示词或对话过长，超出模型上下文限制。请缩短输入、删除较早消息或新开会话后重试。";
    }
    if (message.includes("503")) {
      return "服务暂时繁忙（503），请稍后重试，或切换其他模型后再发送。";
    }
    if (message.includes("504")) {
      return "网关超时（504），请求等待过久，请稍后重试。";
    }
    if (message.includes("401") || message.includes("403")) {
      return "鉴权失败，请检查 API Key 是否有效。";
    }
    if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
      return "请求过于频繁（限流），请稍后再试或更换模型。";
    }
    if (message.toLowerCase().includes("timeout") || message.includes("ETIMEDOUT")) {
      return "请求超时，请检查网络后重试。";
    }
    return `请求失败：${message}`;
  };

  /** 合并已生成片段与中止说明；并消费 `streamUserAbortKindRef`。 */
  function formatAbortedStreamAssistantContent(acc: string, reason: StreamAbortReason): string {
    const kind = streamUserAbortKindRef.current;
    streamUserAbortKindRef.current = null;

    if (reason === "timeout") {
      return acc ? `${acc}\n\n*（客户端等待超时，流式连接已结束）*` : "客户端等待超时，未收到完整回复。";
    }
    if (reason === "user") {
      if (kind === "conversation-switch") {
        return acc ? `${acc}\n\n*（已切换会话，生成中断）*` : "已切换会话，生成已中断。";
      }
      return acc ? `${acc}\n\n*（已手动停止生成）*` : "已停止生成。";
    }
    return acc ? `${acc}\n\n*（生成已停止）*` : "生成已停止。";
  }

  const saveFinalMessages = useCallback(
    async (conversationId: string, messages: ChatMessage[]) => {
      await saveMessages(conversationId, messages);
    },
    [saveMessages],
  );

  const stopGeneration = useCallback(() => {
    streamUserAbortKindRef.current = "stop";
    streamAbortRef.current?.abort();
  }, []);

  const runStreamForAssistant = useCallback(
    async (params: {
      conversationId: string;
      assistantId: string;
      userMessage: ChatMessage;
      content: string;
      attachments: ChatAttachment[];
      apiProfile: ApiRequestProfile;
      chatModel: string;
      chatSettings: ModelGenerationSettings;
      thinkingEnabled: boolean;
      historyMessages?: ChatMessage[];
    }) => {
      const {
        conversationId,
        assistantId,
        userMessage,
        content,
        attachments,
        apiProfile,
        chatModel,
        chatSettings,
        thinkingEnabled,
        historyMessages,
      } = params;
      let acc = "";
      let thinkingAcc = "";
      const history =
        historyMessages ??
        (useChatStore.getState().messagesByConversation[conversationId] ?? []).filter(
          (m) => m.id !== userMessage.id && m.id !== assistantId,
        );
      const apiMessages = buildApiMessagesFromChat(history, content, attachments);

      const ac = new AbortController();
      streamAbortRef.current = ac;

      await streamChatCompletion(
        apiProfile,
        {
          model: chatModel,
          reasoning_effort: thinkingEnabled ? "high" : undefined,
          temperature: chatSettings.temperature,
          top_p: chatSettings.topP,
          max_tokens: chatSettings.maxTokens,
          presence_penalty: chatSettings.presencePenalty,
          frequency_penalty: chatSettings.frequencyPenalty,
          messages: apiMessages,
        },
        {
          onToken: (token) => {
            acc += token;
            patchAssistantMessage(conversationId, assistantId, { content: acc });
          },
          onReasoningToken: (token) => {
            if (!thinkingEnabled) return;
            thinkingAcc += token;
            patchAssistantMessage(conversationId, assistantId, { thinkingContent: thinkingAcc });
          },
          onDone: async (usage) => {
            setLastTokenUsage(usage);
            const list = useChatStore.getState().messagesByConversation[conversationId] ?? [];
            const final = list.map((m) => {
              if (m.id !== assistantId) return m;
              const base = {
                ...m,
                content: acc,
                thinkingContent: thinkingAcc || undefined,
                tokenUsage: usage,
              };
              if (m.variants) {
                const newVariant: ChatMessageVariant = {
                  content: acc,
                  thinkingContent: thinkingAcc || undefined,
                  modelName: m.modelName,
                  tokenUsage: usage,
                  createdAt: m.createdAt,
                };
                const variants = [...m.variants, newVariant];
                return { ...base, variants, activeVariantIdx: variants.length - 1 };
              }
              return base;
            });
            await saveFinalMessages(conversationId, final);
          },
          onAbort: async (reason) => {
            const text = formatAbortedStreamAssistantContent(acc, reason);
            patchAssistantMessage(conversationId, assistantId, { content: text, thinkingContent: thinkingAcc || undefined });
            const patched = (useChatStore.getState().messagesByConversation[conversationId] ?? []).map((m) =>
              m.id === assistantId
                ? { ...m, content: text, thinkingContent: thinkingAcc || undefined }
                : m,
            );
            await saveFinalMessages(conversationId, patched);
          },
        },
        { signal: ac.signal, streamTimeoutMs: DEFAULT_STREAM_TIMEOUT_MS },
      );
    },
    [
      patchAssistantMessage,
      saveFinalMessages,
      setLastTokenUsage,
    ],
  );

  const runImageForAssistant = useCallback(
    async (params: { conversationId: string; assistantId: string; prompt: string; imageModel: string; apiProfile: ApiRequestProfile }) => {
      const { conversationId, assistantId, prompt, imageModel, apiProfile } = params;
      const ac = new AbortController();
      streamAbortRef.current = ac;

      try {
        const images = await generateImage(
          apiProfile,
          { model: imageModel, prompt: prompt || " ", size: "1024x1024" },
          { signal: ac.signal },
        );
        const text = images.length ? images.map((url) => `![generated](${url})`).join("\n\n") : "未生成图片，请检查模型或配额。";
        updateMessage(conversationId, assistantId, {
          content: text,
          modelName: imageModel,
          generatedImageUrls: images,
        });
        const list = useChatStore.getState().messagesByConversation[conversationId] ?? [];
        await saveFinalMessages(conversationId, list);
      } catch (error) {
        if (isAbortError(error)) {
          const kind = streamUserAbortKindRef.current;
          streamUserAbortKindRef.current = null;
          const msg = kind === "conversation-switch" ? "已切换会话，生成已中断。" : "已停止生成。";
          patchAssistantMessage(conversationId, assistantId, { content: msg });
          const list = useChatStore.getState().messagesByConversation[conversationId] ?? [];
          await saveFinalMessages(
            conversationId,
            list.map((m) => (m.id === assistantId ? { ...m, content: msg } : m)),
          );
          return;
        }
        throw error;
      }
    },
    [patchAssistantMessage, saveFinalMessages, updateMessage],
  );

  const sendMessage = useCallback(
    async (payload: SendPayload) => {
      const content = payload.text;
      const attachments = payload.attachments ?? [];
      if (sendLockRef.current) return;
      if (loading) return;

      const settingsSnapshot = useSettingsStore.getState();
      const apiProfile = settingsSnapshot.getActiveApiProfile();
      const selectedGenerationMode = settingsSnapshot.generationMode;
      const selectedChatModel = settingsSnapshot.activeModel;
      const selectedImageModel = settingsSnapshot.activeImageModel;
      const selectedThinkingEnabled = settingsSnapshot.enableThinking;
      const selectedChatSettings = settingsSnapshot.modelSettingsById[selectedChatModel] ?? FALLBACK_MODEL_SETTINGS;

      if (!apiProfile.apiKey) {
        setApiKeyModalOpen(true);
        return;
      }
      const trimmed = content.trim();
      if (!trimmed && attachments.length === 0) return;

      setClientNotice(null);
      lastUserPayloadRef.current = { text: content, attachments };

      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = await createConversation(
          selectedGenerationMode === "image" ? selectedImageModel : selectedChatModel,
        );
      }
      if (!conversationId) return;

      const userCreatedAt = Date.now();
      const userMessage: ChatMessage = {
        id: uid(),
        role: "user",
        senderName: userName,
        senderAvatar: userAvatarText,
        content: trimmed || (attachments.length ? "[附件]" : ""),
        createdAt: userCreatedAt,
        attachments,
        imageUrls: attachments
          .filter((item) => item.kind === "image" && item.status === "ready" && item.dataUrl)
          .map((item) => item.dataUrl!),
      };
      const assistantId = uid();
      const assistantCreatedAt = Math.max(Date.now(), userCreatedAt + 1);
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        senderName: "Assistant",
        modelName: selectedGenerationMode === "image" ? selectedImageModel : selectedChatModel,
        content: "",
        createdAt: assistantCreatedAt,
      };
      addMessage(conversationId, userMessage);
      addMessage(conversationId, assistantMessage);
      setLoading(true);
      sendLockRef.current = true;

      try {
        if (selectedGenerationMode === "image") {
          await runImageForAssistant({
            conversationId,
            assistantId,
            prompt: trimmed,
            imageModel: selectedImageModel,
            apiProfile,
          });
        } else {
          await runStreamForAssistant({
            conversationId,
            assistantId,
            userMessage,
            content: trimmed,
            attachments,
            apiProfile,
            chatModel: selectedChatModel,
            chatSettings: selectedChatSettings,
            thinkingEnabled: selectedThinkingEnabled,
          });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          const fallback = buildFriendlyError(error);
          setClientNotice(fallback);
          patchAssistantMessage(conversationId, assistantId, { content: fallback });
          const list = useChatStore.getState().messagesByConversation[conversationId] ?? [];
          const final = list.map((m) => (m.id === assistantId ? { ...m, content: fallback } : m));
          await saveFinalMessages(conversationId, final);
        }
      } finally {
        sendLockRef.current = false;
        setLoading(false);
        streamAbortRef.current = null;
      }
    },
    [
      activeConversationId,
      addMessage,
      createConversation,
      loading,
      patchAssistantMessage,
      runStreamForAssistant,
      runImageForAssistant,
      saveFinalMessages,
      setApiKeyModalOpen,
      setClientNotice,
      setLoading,
      userAvatarText,
      userName,
    ],
  );

  /** 重新生成：原地更新末尾助手消息，保留旧版本快照到 variants */
  const regenerateAssistantMessage = useCallback(
    async (assistantMessageId: string) => {
      const convId = activeConversationId;
      if (!convId) return;
      const settingsSnapshot = useSettingsStore.getState();
      const apiProfile = settingsSnapshot.getActiveApiProfile();
      if (!apiProfile.apiKey) {
        setApiKeyModalOpen(true);
        return;
      }
      if (sendLockRef.current || loading) return;

      const list = messagesByConversation[convId] ?? [];
      const assistantIdx = list.findIndex((m) => m.id === assistantMessageId);
      if (assistantIdx < 0) return;
      const targetAssistant = list[assistantIdx];
      if (!targetAssistant || targetAssistant.role !== "assistant") return;

      let userIdx = -1;
      for (let i = assistantIdx - 1; i >= 0; i -= 1) {
        if (list[i]?.role === "user") {
          userIdx = i;
          break;
        }
      }
      if (userIdx < 0) return;
      const targetUser = list[userIdx]!;
      const historyMessages = list.slice(0, userIdx);
      const useImageGen = Boolean(targetAssistant.generatedImageUrls?.length) || isImageModel(targetAssistant.modelName);
      const selectedChatModel = settingsSnapshot.activeModel;
      const selectedImageModel = settingsSnapshot.activeImageModel;
      const selectedThinkingEnabled = settingsSnapshot.enableThinking;
      const selectedChatSettings = settingsSnapshot.modelSettingsById[selectedChatModel] ?? FALLBACK_MODEL_SETTINGS;

      const existingVariants: ChatMessageVariant[] = targetAssistant.variants ?? [
        {
          content: targetAssistant.content,
          thinkingContent: targetAssistant.thinkingContent,
          modelName: targetAssistant.modelName,
          tokenUsage: targetAssistant.tokenUsage,
          createdAt: targetAssistant.createdAt,
        },
      ];

      const updatedAssistant: ChatMessage = {
        ...targetAssistant,
        content: "",
        thinkingContent: undefined,
        modelName: useImageGen ? selectedImageModel : selectedChatModel,
        createdAt: Date.now(),
        variants: existingVariants,
        activeVariantIdx: existingVariants.length,
      };

      const nextMessages = list.map((m, idx) => (idx === assistantIdx ? updatedAssistant : m));
      replaceMessages(convId, nextMessages);
      await saveFinalMessages(convId, nextMessages);

      setLoading(true);
      sendLockRef.current = true;
      try {
        if (useImageGen) {
          await runImageForAssistant({
            conversationId: convId,
            assistantId: assistantMessageId,
            prompt: targetUser.content,
            imageModel: selectedImageModel,
            apiProfile,
          });
        } else {
          await runStreamForAssistant({
            conversationId: convId,
            assistantId: assistantMessageId,
            userMessage: targetUser,
            content: targetUser.content,
            attachments: targetUser.attachments ?? [],
            apiProfile,
            chatModel: selectedChatModel,
            chatSettings: selectedChatSettings,
            thinkingEnabled: selectedThinkingEnabled,
            historyMessages,
          });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          const fallback = buildFriendlyError(error);
          patchAssistantMessage(convId, assistantMessageId, { content: fallback });
          const l = useChatStore.getState().messagesByConversation[convId] ?? [];
          await saveFinalMessages(
            convId,
            l.map((m) => (m.id === assistantMessageId ? { ...m, content: fallback } : m)),
          );
        }
      } finally {
        sendLockRef.current = false;
        setLoading(false);
        streamAbortRef.current = null;
      }
    },
    [
      activeConversationId,
      loading,
      messagesByConversation,
      patchAssistantMessage,
      replaceMessages,
      runImageForAssistant,
      runStreamForAssistant,
      saveFinalMessages,
      setApiKeyModalOpen,
      setLoading,
    ],
  );

  const regenerateFromLastUser = useCallback(async () => {
    const convId = activeConversationId;
    if (!convId) return;
    const list = messagesByConversation[convId] ?? [];
    const lastAssistant = [...list].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    await regenerateAssistantMessage(lastAssistant.id);
  }, [activeConversationId, messagesByConversation, regenerateAssistantMessage]);

  const setAssistantActiveVariant = useCallback(
    async (assistantMessageId: string, variantIdx: number) => {
      const convId = activeConversationId;
      if (!convId) return;
      const list = messagesByConversation[convId] ?? [];
      const target = list.find((m) => m.id === assistantMessageId);
      if (!target || target.role !== "assistant" || !target.variants?.length) return;
      const boundedIdx = Math.max(0, Math.min(target.variants.length - 1, variantIdx));
      const next = list.map((m) =>
        m.id === assistantMessageId
          ? {
              ...m,
              activeVariantIdx: boundedIdx,
            }
          : m,
      );
      replaceMessages(convId, next);
      await saveFinalMessages(convId, next);
    },
    [activeConversationId, messagesByConversation, replaceMessages, saveFinalMessages],
  );

  const editUserMessageAndResend = useCallback(
    async (messageId: string, newContent: string) => {
      const convId = activeConversationId;
      if (!convId) return;
      const settingsSnapshot = useSettingsStore.getState();
      const apiProfile = settingsSnapshot.getActiveApiProfile();
      if (!apiProfile.apiKey) {
        setApiKeyModalOpen(true);
        return;
      }
      if (sendLockRef.current || loading) return;
      const list = messagesByConversation[convId] ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx < 0 || list[idx]!.role !== "user") return;
      const cut = list.slice(0, idx);
      const updatedUser: ChatMessage = { ...list[idx]!, content: newContent };
      const assistantId = uid();
      const selectedGenerationMode = settingsSnapshot.generationMode;
      const selectedChatModel = settingsSnapshot.activeModel;
      const selectedImageModel = settingsSnapshot.activeImageModel;
      const selectedThinkingEnabled = settingsSnapshot.enableThinking;
      const selectedChatSettings = settingsSnapshot.modelSettingsById[selectedChatModel] ?? FALLBACK_MODEL_SETTINGS;
      const useImageGen = selectedGenerationMode === "image";
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        senderName: "Assistant",
        modelName: useImageGen ? selectedImageModel : selectedChatModel,
        content: "",
        createdAt: Date.now(),
      };
      replaceMessages(convId, [...cut, updatedUser, assistantMessage]);
      await saveFinalMessages(convId, [...cut, updatedUser, assistantMessage]);

      setLoading(true);
      sendLockRef.current = true;
      try {
        if (useImageGen) {
          await runImageForAssistant({
            conversationId: convId,
            assistantId,
            prompt: newContent,
            imageModel: selectedImageModel,
            apiProfile,
          });
        } else {
          await runStreamForAssistant({
            conversationId: convId,
            assistantId,
            userMessage: updatedUser,
            content: newContent,
            attachments: updatedUser.attachments ?? [],
            apiProfile,
            chatModel: selectedChatModel,
            chatSettings: selectedChatSettings,
            thinkingEnabled: selectedThinkingEnabled,
          });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          const fallback = buildFriendlyError(error);
          patchAssistantMessage(convId, assistantId, { content: fallback });
          const l = useChatStore.getState().messagesByConversation[convId] ?? [];
          await saveFinalMessages(
            convId,
            l.map((m) => (m.id === assistantId ? { ...m, content: fallback } : m)),
          );
        }
      } finally {
        sendLockRef.current = false;
        setLoading(false);
        streamAbortRef.current = null;
      }
    },
    [
      activeConversationId,
      loading,
      messagesByConversation,
      patchAssistantMessage,
      replaceMessages,
      runImageForAssistant,
      runStreamForAssistant,
      saveFinalMessages,
      setApiKeyModalOpen,
      setLoading,
    ],
  );

  const removeMessage = useCallback(
    async (messageId: string) => {
      const convId = activeConversationId;
      if (!convId) return;
      const list = messagesByConversation[convId] ?? [];
      const next = list.filter((m) => m.id !== messageId);
      replaceMessages(convId, next);
      await saveFinalMessages(convId, next);
    },
    [activeConversationId, messagesByConversation, replaceMessages, saveFinalMessages],
  );

  const retryLast = useCallback(() => {
    const p = lastUserPayloadRef.current;
    if (p) void sendMessage(p);
  }, [sendMessage]);

  const clearClientNotice = useCallback(() => {
    setClientNotice(null);
  }, [setClientNotice]);

  return useMemo(
    () => ({
      sendMessage,
      loading,
      stopGeneration,
      regenerateFromLastUser,
      regenerateAssistantMessage,
      editUserMessageAndResend,
      setAssistantActiveVariant,
      removeMessage,
      retryLast,
      clearClientNotice,
    }),
    [
      clearClientNotice,
      editUserMessageAndResend,
      loading,
      regenerateAssistantMessage,
      regenerateFromLastUser,
      removeMessage,
      retryLast,
      sendMessage,
      setAssistantActiveVariant,
      stopGeneration,
    ],
  );
}
