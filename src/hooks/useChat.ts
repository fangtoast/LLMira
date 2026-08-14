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
import { inferModelCapabilities } from "@llmira/provider-core";
import { buildApiMessagesFromChat } from "@/lib/chat/buildMessages";
import { DEFAULT_STREAM_TIMEOUT_MS, generateImage, normalizeBaseUrl, streamChatCompletion, type ApiRequestProfile } from "@/lib/api/client";
import type { ChatCompletionRequest, ImageGenerationRequest, StreamAbortReason } from "@/lib/api/types";
import { parseToolArguments } from "@/lib/api/toolCalls";
import { requestToolApproval } from "@/lib/mcp/approval";
import { collectMcpChatTools } from "@/lib/mcp/chatTools";
import { getMcpRuntimeAdapter } from "@/lib/mcp/runtime";
import { useChatStore } from "@/lib/store/chatStore";
import { useSettingsStore, type ModelGenerationSettings } from "@/lib/store/settingsStore";
import { resolveReasoningEffort, type ReasoningMode } from "@/lib/models/catalog";
import { searchWeb } from "@/lib/search/webSearch";
import { useConversations } from "./useConversations";
import type { ApiRequestSnapshot, ChatAttachment, ChatMessage, ChatMessageVariant, TokenUsage } from "@/types";
import type { McpToolCall } from "@/lib/mcp/types";
import { sumTokenUsage } from "@/lib/usage/tokens";

const loadUsageRecorders = () => import("@/lib/usage/recorders");

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

export const MAX_MCP_TOOL_ROUNDS = 4;
export const MAX_MCP_TOOL_CALLS = 8;

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
    mcpServers,
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
      reasoningMode: ReasoningMode;
      supportsReasoning: boolean;
      supportsTools: boolean;
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
        reasoningMode,
        supportsReasoning,
        supportsTools,
        historyMessages,
        contextWindow,
        nativeWebSearch,
        evidence,
        citations,
      } = params;
      let acc = "";
      let thinkingAcc = "";
      let persistedToolCalls: McpToolCall[] = [];
      const history =
        historyMessages ??
        (useChatStore.getState().messagesByConversation[conversationId] ?? []).filter(
          (m) => m.id !== userMessage.id && m.id !== assistantId,
        );
      const apiMessages = buildApiMessagesFromChat(history, content, attachments, { contextWindow, evidence });
      if (citations?.length) updateMessage(conversationId, assistantId, { citations });

      const ac = new AbortController();
      streamAbortRef.current = ac;
      const enabledServers = mcpServers.filter((server) => server.enabled);
      const chatTools = enabledServers.length ? await collectMcpChatTools(enabledServers) : [];
      if (chatTools.length && !supportsTools) {
        throw new Error("当前模型不支持工具调用，请在默认模型设置中选择支持 Tools 的聊天模型。");
      }

      const toolByWireName = new Map(chatTools.map((tool) => [tool.descriptor.wireName, tool]));
      const runtime = await getMcpRuntimeAdapter();
      const protocolMessages = [...apiMessages];
      let totalUsage: TokenUsage | undefined;

      const persistCurrent = () => {
        updateMessage(conversationId, assistantId, {
          content: acc,
          thinkingContent: thinkingAcc || undefined,
          toolCalls: persistedToolCalls.length ? persistedToolCalls : undefined,
        });
      };

      const persistAbort = async (reason: StreamAbortReason) => {
        const text = formatAbortedStreamAssistantContent(acc, reason);
        updateMessage(conversationId, assistantId, {
          content: text,
          thinkingContent: thinkingAcc || undefined,
          toolCalls: persistedToolCalls.length ? persistedToolCalls : undefined,
          status: acc ? "partial" : "cancelled",
        });
        await saveFinalMessages(conversationId, useChatStore.getState().messagesByConversation[conversationId] ?? []);
      };

      const persistComplete = async () => {
        setLastTokenUsage(totalUsage);
        const list = useChatStore.getState().messagesByConversation[conversationId] ?? [];
        const final = list.map((message) => {
          if (message.id !== assistantId) return message;
          const base = {
            ...message,
            content: acc,
            thinkingContent: thinkingAcc || undefined,
            tokenUsage: totalUsage,
            toolCalls: persistedToolCalls.length ? persistedToolCalls : undefined,
            status: "completed" as const,
          };
          if (!message.variants) return base;
          const variant: ChatMessageVariant = {
            content: acc,
            thinkingContent: thinkingAcc || undefined,
            modelName: message.modelName,
            tokenUsage: totalUsage,
            createdAt: message.createdAt,
          };
          const variants = [...message.variants, variant];
          return { ...base, variants, activeVariantIdx: variants.length - 1 };
        });
        await saveFinalMessages(conversationId, final);
      };

      for (let round = 0; round < MAX_MCP_TOOL_ROUNDS; round += 1) {
        let roundCalls: import("@/lib/api/types").ChatToolCallWire[] = [];
        let abortReason: StreamAbortReason | undefined;
        let roundUsage: TokenUsage | undefined;
        const requestStartedAt = Date.now();
        try {
          await streamChatCompletion(
          apiProfile,
          {
            model: chatModel,
            reasoning_effort: resolveReasoningEffort(reasoningMode, supportsReasoning),
            temperature: chatSettings.temperature,
            top_p: chatSettings.topP,
            max_tokens: chatSettings.maxTokens,
            presence_penalty: chatSettings.presencePenalty,
            frequency_penalty: chatSettings.frequencyPenalty,
            messages: protocolMessages,
            web_search_options: nativeWebSearch ? {} : undefined,
            tools: chatTools.length ? chatTools.map((tool) => tool.definition) : undefined,
            tool_choice: chatTools.length ? "auto" : undefined,
          },
          {
            onToken: (token) => {
              acc += token;
              patchAssistantMessage(conversationId, assistantId, { content: acc });
            },
            onReasoningToken: (token) => {
              if (!supportsReasoning) return;
              thinkingAcc += token;
              patchAssistantMessage(conversationId, assistantId, { thinkingContent: thinkingAcc });
            },
            onDone: (usage, toolCalls) => {
              roundUsage = usage;
              totalUsage = sumTokenUsage(totalUsage, usage);
              roundCalls = toolCalls ?? [];
            },
            onAbort: (reason) => {
              abortReason = reason;
            },
          },
          { signal: ac.signal, streamTimeoutMs: DEFAULT_STREAM_TIMEOUT_MS },
          );
        } catch (error) {
          await (await loadUsageRecorders()).recordModelUsage(assistantId, requestStartedAt, "failed", apiProfile, chatModel, conversationId, assistantId, roundUsage, nativeWebSearch);
          throw error;
        }
        const recordedUsage = await (await loadUsageRecorders()).recordModelUsage(assistantId, requestStartedAt, abortReason === "timeout" ? "timeout" : abortReason ? "cancelled" : "completed", apiProfile, chatModel, conversationId, assistantId, roundUsage, nativeWebSearch);
        if (recordedUsage.costUsd !== undefined && totalUsage) totalUsage = { ...totalUsage, estimatedCostUSD: (totalUsage.estimatedCostUSD ?? 0) + recordedUsage.costUsd };

        if (abortReason) {
          await persistAbort(abortReason);
          return;
        }
        if (!roundCalls.length) {
          await persistComplete();
          return;
        }
        if (persistedToolCalls.length + roundCalls.length > MAX_MCP_TOOL_CALLS) {
          throw new Error(`单次消息最多允许 ${MAX_MCP_TOOL_CALLS} 次工具调用。`);
        }

        const calls = roundCalls.map((wireCall): McpToolCall => {
          const tool = toolByWireName.get(wireCall.function.name);
          if (!tool) {
            return {
              id: wireCall.id,
              wireName: wireCall.function.name,
              serverId: "unknown",
              serverName: "未知服务器",
              toolName: wireCall.function.name,
              argumentsText: wireCall.function.arguments,
              approval: "rejected",
              status: "failed",
              error: "模型请求了当前目录中不存在或已禁用的工具。",
              completedAt: Date.now(),
            };
          }
          try {
            return {
              id: wireCall.id,
              wireName: wireCall.function.name,
              serverId: tool.descriptor.serverId,
              serverName: tool.descriptor.serverName,
              toolName: tool.descriptor.name,
              argumentsText: wireCall.function.arguments,
              arguments: parseToolArguments(wireCall.function.arguments),
              approval: "required",
              status: "pending",
            };
          } catch (error) {
            return {
              id: wireCall.id,
              wireName: wireCall.function.name,
              serverId: tool.descriptor.serverId,
              serverName: tool.descriptor.serverName,
              toolName: tool.descriptor.name,
              argumentsText: wireCall.function.arguments,
              approval: "rejected",
              status: "failed",
              error: error instanceof Error ? error.message : "工具参数不是有效 JSON。",
              completedAt: Date.now(),
            };
          }
        });
        persistedToolCalls = [...persistedToolCalls, ...calls];
        persistCurrent();

        for (const call of calls) {
          if (call.status === "failed") continue;
          const approved = await requestToolApproval(call.id, ac.signal);
          if (ac.signal.aborted) {
            await persistAbort("user");
            return;
          }
          if (!approved) {
            call.approval = "rejected";
            call.status = "rejected";
            call.resultSummary = "用户拒绝了此工具调用。";
            call.completedAt = Date.now();
            persistedToolCalls = persistedToolCalls.map((item) => item.id === call.id ? { ...call } : item);
            persistCurrent();
            continue;
          }
          call.approval = "approved";
          call.status = "running";
          call.startedAt = Date.now();
          persistedToolCalls = persistedToolCalls.map((item) => item.id === call.id ? { ...call } : item);
          persistCurrent();
          const tool = toolByWireName.get(call.wireName)!;
          const toolStartedAt = Date.now();
          try {
            const result = await runtime.callTool(
              tool.connection,
              call.toolName,
              call.arguments ?? {},
              { callId: call.id, signal: ac.signal, timeoutMs: tool.connection.config.timeoutSeconds * 1_000 },
            );
            call.status = result.isError ? "failed" : "completed";
            call.resultSummary = result.summary;
            call.error = result.isError ? result.summary : undefined;
          } catch (error) {
            call.status = ac.signal.aborted ? "cancelled" : "failed";
            call.error = error instanceof Error ? error.message : "工具调用失败。";
          }
          call.completedAt = Date.now();
          await (await loadUsageRecorders()).recordMcpUsage(assistantId, toolStartedAt, call.status === "completed" ? "completed" : call.status === "cancelled" ? "cancelled" : "failed", conversationId, assistantId, { serverId: call.serverId, serverName: call.serverName, toolName: call.toolName });
          persistedToolCalls = persistedToolCalls.map((item) => item.id === call.id ? { ...call } : item);
          persistCurrent();
        }

        protocolMessages.push({
          role: "assistant",
          content: null,
          tool_calls: roundCalls,
        });
        for (const call of calls) {
          protocolMessages.push({
            role: "tool",
            tool_call_id: call.id,
            name: call.wireName,
            content: call.resultSummary ?? call.error ?? "工具未返回结果。",
          });
        }
      }

      throw new Error(`工具续跑已达到 ${MAX_MCP_TOOL_ROUNDS} 轮上限。`);
    },
    [
      mcpServers,
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

      const requestStartedAt = Date.now();
      let imageUsage: TokenUsage | undefined;
      let imageAbortReason: StreamAbortReason | undefined;
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
              onDone: async (usage) => {
                imageUsage = usage;
                images = extractGeneratedImageUrls(text);
              },
              onAbort: async (reason) => {
                imageAbortReason = reason;
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
        await (await loadUsageRecorders()).recordImageUsage(assistantId, requestStartedAt, imageAbortReason === "timeout" ? "timeout" : imageAbortReason ? "cancelled" : "completed", apiProfile, imageModel, conversationId, assistantId, { count: images.length || 1, size: "size" in requestBody ? String(requestBody.size ?? "auto") : "auto", quality: "quality" in requestBody ? String(requestBody.quality ?? "auto") : "auto" }, imageUsage);
        const list = useChatStore.getState().messagesByConversation[conversationId] ?? [];
        const final = list.map((m) => {
          if (m.id !== assistantId) return m;
          const base: ChatMessage = {
            ...m,
            content: finalText,
            modelName: imageModel,
            providerId: apiProfile.id,
            status: imageAbortReason ? (text ? "partial" : "cancelled") : "completed",
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
        await (await loadUsageRecorders()).recordImageUsage(assistantId, requestStartedAt, isAbortError(error) ? "cancelled" : "failed", apiProfile, imageModel, conversationId, assistantId, { count: 1 }, imageUsage);
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
      const selectedReasoningMode = settingsSnapshot.reasoningModeByProviderModel[apiProfile.id]?.[selectedChatModel] ?? "auto";
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
            const searchStartedAt = Date.now();
            try {
              const searched = await searchWeb(trimmed, { provider: settingsSnapshot.searchProvider, baseUrl: settingsSnapshot.searchBaseUrl || undefined, apiKey: settingsSnapshot.searchApiKey || undefined });
              evidence = searched.evidence;
              citations = searched.citations;
              await (await loadUsageRecorders()).recordSearchUsage(assistantId, searchStartedAt, "completed", conversationId, assistantId, settingsSnapshot.searchProvider);
            } catch (searchError) {
              await (await loadUsageRecorders()).recordSearchUsage(assistantId, searchStartedAt, "failed", conversationId, assistantId, settingsSnapshot.searchProvider);
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
            reasoningMode: selectedReasoningMode,
            supportsReasoning: selectedModelMetadata?.capabilities.reasoning ?? inferModelCapabilities(selectedChatModel).reasoning,
            supportsTools: selectedModelMetadata?.capabilities.tools ?? inferModelCapabilities(selectedChatModel).tools,
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
      const selectedReasoningMode = settingsSnapshot.reasoningModeByProviderModel[apiProfile.id]?.[selectedChatModel] ?? "auto";
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
        toolCalls: undefined,
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
          const selectedModelMetadata = apiProfile.modelCatalog.find((model) => model.id === selectedChatModel);
          await runStreamForAssistant({
            conversationId: convId,
            assistantId: assistantMessageId,
            userMessage: targetUser,
            content: targetUser.content,
            attachments: targetUser.attachments ?? [],
            apiProfile,
            chatModel: selectedChatModel,
            chatSettings: selectedChatSettings,
            reasoningMode: selectedReasoningMode,
            supportsReasoning: selectedModelMetadata?.capabilities.reasoning ?? inferModelCapabilities(selectedChatModel).reasoning,
            supportsTools: selectedModelMetadata?.capabilities.tools ?? inferModelCapabilities(selectedChatModel).tools,
            historyMessages,
            contextWindow: selectedModelMetadata?.contextWindow,
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
      const selectedReasoningMode = settingsSnapshot.reasoningModeByProviderModel[apiProfile.id]?.[selectedChatModel] ?? "auto";
      const selectedChatSettings = settingsSnapshot.modelSettingsById[selectedChatModel] ?? FALLBACK_MODEL_SETTINGS;
      const useImageGen = selectedGenerationMode === "image";
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        senderName: "Assistant",
        modelName: useImageGen ? selectedImageModel : selectedChatModel,
        content: "",
        toolCalls: undefined,
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
          const selectedModelMetadata = apiProfile.modelCatalog.find((model) => model.id === selectedChatModel);
          await runStreamForAssistant({
            conversationId: convId,
            assistantId,
            userMessage: updatedUser,
            content: newContent,
            attachments: updatedUser.attachments ?? [],
            apiProfile,
            chatModel: selectedChatModel,
            chatSettings: selectedChatSettings,
            reasoningMode: selectedReasoningMode,
            supportsReasoning: selectedModelMetadata?.capabilities.reasoning ?? inferModelCapabilities(selectedChatModel).reasoning,
            supportsTools: selectedModelMetadata?.capabilities.tools ?? inferModelCapabilities(selectedChatModel).tools,
            contextWindow: selectedModelMetadata?.contextWindow,
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
