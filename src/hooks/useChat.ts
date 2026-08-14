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
import { DEFAULT_STREAM_TIMEOUT_MS, generateImage, normalizeBaseUrl, streamChatCompletion, type ApiRequestProfile } from "@/lib/api/client";
import type { ChatCompletionRequest, ImageGenerationRequest, StreamAbortReason } from "@/lib/api/types";
import { useChatStore } from "@/lib/store/chatStore";
import { useSettingsStore, type ModelGenerationSettings } from "@/lib/store/settingsStore";
import { searchWeb } from "@/lib/search/webSearch";
import { useConversations } from "./useConversations";
import type { ApiRequestSnapshot, ChatAttachment, ChatMessage, ChatMessageVariant } from "@/types";

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

function shouldUseChatImageEndpoint(modelName: string): boolean {
  return /(gpt-4o-image|gemini.*image|image-preview)/i.test(modelName) && !/gpt-image|dall/i.test(modelName);
}

function getAttachmentImageUrls(attachments: ChatAttachment[] = []) {
  return attachments
    .filter((item) => item.kind === "image" && item.status === "ready" && (item.remoteUrl || item.dataUrl))
    .map((item) => item.remoteUrl || item.dataUrl!)
    .filter(Boolean);
}

function extractGeneratedImageUrls(content: string) {
  const urls = Array.from(content.matchAll(/!\[[^\]]*]\(([^)]+)\)|(https?:\/\/[^\s)]+)/g))
    .map((match) => match[1] ?? match[2] ?? "")
    .filter(Boolean);
  return [...new Set(urls)];
}

function createImageGenerationPayload(model: string, prompt: string, imageUrls: string[]): ImageGenerationRequest {
  const base = {
    model,
    prompt: prompt || " ",
    quality: "auto",
    response_format: "url",
    n: 1,
  } satisfies ImageGenerationRequest;

  if (imageUrls.length > 0) {
    return {
      ...base,
      image: imageUrls,
    };
  }

  return {
    ...base,
    taskType: "IMAGE",
    size: "auto",
  };
}

function createRequestSnapshot(
  apiProfile: ApiRequestProfile,
  kind: ApiRequestSnapshot["kind"],
  path: string,
  body: unknown,
): ApiRequestSnapshot {
  const baseUrl = normalizeBaseUrl(apiProfile.baseUrl);
  return {
    kind,
    providerId: apiProfile.id,
    baseUrl,
    endpoint: `${baseUrl}${path}`,
    body,
    createdAt: Date.now(),
  };
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
      contextWindow?: number;
      nativeWebSearch?: boolean;
      evidence?: string;
      citations?: ChatMessage["citations"];
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
        contextWindow,
        nativeWebSearch,
        evidence,
        citations,
      } = params;
      let acc = "";
      let thinkingAcc = "";
      const history =
        historyMessages ??
        (useChatStore.getState().messagesByConversation[conversationId] ?? []).filter(
          (m) => m.id !== userMessage.id && m.id !== assistantId,
        );
      const apiMessages = buildApiMessagesFromChat(history, content, attachments, { contextWindow, evidence });
      if (citations?.length) updateMessage(conversationId, assistantId, { citations });

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
          web_search_options: nativeWebSearch ? {} : undefined,
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
                status: "completed" as const,
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
            updateMessage(conversationId, assistantId, { content: text, thinkingContent: thinkingAcc || undefined, status: acc ? "partial" : "cancelled" });
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
      updateMessage,
    ],
  );

  const runImageForAssistant = useCallback(
    async (params: {
      conversationId: string;
      assistantId: string;
      userMessage: ChatMessage;
      prompt: string;
      attachments: ChatAttachment[];
      imageModel: string;
      apiProfile: ApiRequestProfile;
      historyMessages?: ChatMessage[];
    }) => {
      const { conversationId, assistantId, userMessage, prompt, attachments, imageModel, apiProfile, historyMessages } = params;
      const ac = new AbortController();
      streamAbortRef.current = ac;
      const history =
        historyMessages ??
        (useChatStore.getState().messagesByConversation[conversationId] ?? []).filter(
          (m) => m.id !== userMessage.id && m.id !== assistantId,
        );
      const imageUrls = getAttachmentImageUrls(attachments);
      const useChatImageEndpoint = shouldUseChatImageEndpoint(imageModel);
      const requestBody = useChatImageEndpoint
        ? {
            model: imageModel,
            group: "auto",
            messages: buildApiMessagesFromChat(history, prompt, attachments),
            stream: true,
          }
        : createImageGenerationPayload(imageModel, prompt, imageUrls);
      const requestSnapshot = createRequestSnapshot(
        apiProfile,
        useChatImageEndpoint ? "chat" : "image",
        useChatImageEndpoint ? "/v1/chat/completions" : "/v1/images/generations",
        requestBody,
      );
      updateMessage(conversationId, assistantId, {
        modelName: imageModel,
        requestSnapshot,
      });

      try {
        let text = "";
        let images: string[] = [];
        if (useChatImageEndpoint) {
          await streamChatCompletion(
            apiProfile,
            requestBody as ChatCompletionRequest,
            {
              onToken: (token) => {
                text += token;
                patchAssistantMessage(conversationId, assistantId, { content: text });
              },
              onDone: async () => {
                images = extractGeneratedImageUrls(text);
              },
              onAbort: async (reason) => {
                const abortedText = formatAbortedStreamAssistantContent(text, reason);
                patchAssistantMessage(conversationId, assistantId, { content: abortedText });
                text = abortedText;
              },
            },
            { signal: ac.signal, streamTimeoutMs: DEFAULT_STREAM_TIMEOUT_MS },
          );
          images = extractGeneratedImageUrls(text);
        } else {
          images = await generateImage(
            apiProfile,
            requestBody as ImageGenerationRequest,
            { signal: ac.signal },
          );
          text = images.length ? images.map((url) => `![generated](${url})`).join("\n\n") : "";
        }
        const finalText = text || "未生成图片，请检查模型或配额。";
        const list = useChatStore.getState().messagesByConversation[conversationId] ?? [];
        const final = list.map((m) => {
          if (m.id !== assistantId) return m;
          const base: ChatMessage = {
            ...m,
            content: finalText,
            modelName: imageModel,
            providerId: apiProfile.id,
            status: "completed",
            generatedImageUrls: images,
            requestSnapshot,
          };
          if (m.variants) {
            const newVariant: ChatMessageVariant = {
              content: finalText,
              modelName: imageModel,
              generatedImageUrls: images,
              requestSnapshot,
              createdAt: m.createdAt,
            };
            const variants = [...m.variants, newVariant];
            return { ...base, variants, activeVariantIdx: variants.length - 1 };
          }
          return base;
        });
        replaceMessages(conversationId, final);
        await saveFinalMessages(conversationId, final);
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
    [patchAssistantMessage, replaceMessages, saveFinalMessages, updateMessage],
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
        providerId: apiProfile.id,
        modelName: selectedGenerationMode === "image" ? selectedImageModel : selectedChatModel,
        status: "completed",
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
        providerId: apiProfile.id,
        status: "running",
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
            userMessage,
            prompt: trimmed,
            attachments,
            imageModel: selectedImageModel,
            apiProfile,
          });
        } else {
          const selectedModelMetadata = apiProfile.modelCatalog?.find?.((model) => model.id === selectedChatModel);
          const wantsSearch = settingsSnapshot.webSearchMode === "on" || (settingsSnapshot.webSearchMode === "auto" && /(最新|今天|当前|新闻|联网|搜索|查找|价格|天气|latest|today|news|search)/i.test(trimmed));
          const nativeWebSearch = wantsSearch && Boolean(selectedModelMetadata?.capabilities.nativeWebSearch);
          let evidence: string | undefined;
          let citations: ChatMessage["citations"];
          if (wantsSearch && !nativeWebSearch) {
            try {
              const searched = await searchWeb(trimmed, { provider: settingsSnapshot.searchProvider, baseUrl: settingsSnapshot.searchBaseUrl || undefined, apiKey: settingsSnapshot.searchApiKey || undefined });
              evidence = searched.evidence;
              citations = searched.citations;
            } catch (searchError) {
              setClientNotice(`联网搜索失败，已继续普通对话：${searchError instanceof Error ? searchError.message : "未知错误"}`);
            }
          }
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
            contextWindow: selectedModelMetadata?.contextWindow,
            nativeWebSearch,
            evidence,
            citations,
          });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          const fallback = buildFriendlyError(error);
          setClientNotice(fallback);
          updateMessage(conversationId, assistantId, { content: fallback, status: "failed" });
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
      runStreamForAssistant,
      runImageForAssistant,
      saveFinalMessages,
      setApiKeyModalOpen,
      setClientNotice,
      setLoading,
      updateMessage,
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
          generatedImageUrls: targetAssistant.generatedImageUrls,
          requestSnapshot: targetAssistant.requestSnapshot,
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
            userMessage: targetUser,
            prompt: targetUser.content,
            attachments: targetUser.attachments ?? [],
            imageModel: selectedImageModel,
            apiProfile,
            historyMessages,
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
            userMessage: updatedUser,
            prompt: newContent,
            attachments: updatedUser.attachments ?? [],
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
