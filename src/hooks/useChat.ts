"use client";

import { useCallback, useMemo } from "react";
import { generateImage, streamChatCompletion } from "@/lib/api/client";
import { useChatStore } from "@/lib/store/chatStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useConversations } from "./useConversations";

function uid() {
  return crypto.randomUUID();
}

export function useChat() {
  const {
    apiKey,
    activeModel,
    activeImageModel,
    generationMode,
    enableThinking,
    userName,
    userAvatarText,
    temperature,
    topP,
    maxTokens,
    presencePenalty,
    frequencyPenalty,
    setApiKeyModalOpen,
  } =
    useSettingsStore();
  const {
    activeConversationId,
    messagesByConversation,
    addMessage,
    patchAssistantMessage,
    setLoading,
    loading,
    setLastTokenUsage,
  } = useChatStore();
  const { createConversation, saveMessages } = useConversations();

  const buildFriendlyError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "未知错误";
    if (message.includes("503")) {
      return "服务暂时繁忙（503），请稍后重试，或切换其他模型后再发送。";
    }
    if (message.includes("401") || message.includes("403")) {
      return "鉴权失败，请检查 API Key 是否有效。";
    }
    return `请求失败：${message}`;
  };

  const sendMessage = useCallback(
    async (payload: { text: string; imageDataUrls?: string[] }) => {
      const content = payload.text;
      const imageDataUrls = payload.imageDataUrls ?? [];
      let conversationId = activeConversationId;
      if (!apiKey) {
        setApiKeyModalOpen(true);
        return;
      }
      if (!conversationId) {
        conversationId = await createConversation(generationMode === "image" ? activeImageModel : activeModel);
      }
      const userMessage = {
        id: uid(),
        role: "user" as const,
        senderName: userName,
        senderAvatar: userAvatarText,
        content,
        createdAt: Date.now(),
        imageUrls: imageDataUrls,
      };
      const assistantId = uid();
      const assistantMessage = {
        id: assistantId,
        role: "assistant" as const,
        senderName: "Assistant",
        modelName: generationMode === "image" ? activeImageModel : activeModel,
        content: "",
        createdAt: Date.now(),
      };
      addMessage(conversationId, userMessage);
      addMessage(conversationId, assistantMessage);
      setLoading(true);

      try {
        if (generationMode === "image") {
          const images = await generateImage(apiKey, {
            model: activeImageModel,
            prompt: content,
            size: "1024x1024",
          });
          const markdown = images.map((url) => `![generated](${url})`).join("\n\n");
          patchAssistantMessage(conversationId, assistantId, {
            content: markdown || "未生成图片，请检查模型或配额。",
          });
          await saveMessages(conversationId, [
            ...(messagesByConversation[conversationId] ?? []),
            userMessage,
            { ...assistantMessage, content: markdown, generatedImageUrls: images },
          ]);
        } else {
          let acc = "";
          let thinkingAcc = "";
          await streamChatCompletion(
            apiKey,
            {
              model: activeModel,
              reasoning_effort: enableThinking ? "high" : undefined,
              temperature,
              top_p: topP,
              max_tokens: maxTokens,
              presence_penalty: presencePenalty,
              frequency_penalty: frequencyPenalty,
              messages: [
                ...(messagesByConversation[conversationId] ?? []).map((item) => ({
                  role: item.role,
                  content:
                    item.role === "user" && item.imageUrls?.length
                      ? [
                          { type: "text" as const, text: item.content },
                          ...item.imageUrls.map((url) => ({
                            type: "image_url" as const,
                            image_url: { url },
                          })),
                        ]
                      : item.content,
                })),
                {
                  role: "user",
                  content: imageDataUrls.length
                    ? [
                        { type: "text" as const, text: content },
                        ...imageDataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
                      ]
                    : content,
                },
              ],
            },
            {
              onToken: (token) => {
                acc += token;
                patchAssistantMessage(conversationId!, assistantId, { content: acc });
              },
              onReasoningToken: (token) => {
                if (!enableThinking) return;
                thinkingAcc += token;
                patchAssistantMessage(conversationId!, assistantId, { thinkingContent: thinkingAcc });
              },
              onDone: async (usage) => {
                setLastTokenUsage(usage);
                await saveMessages(conversationId!, [
                  ...(messagesByConversation[conversationId!] ?? []),
                  userMessage,
                  { ...assistantMessage, content: acc, thinkingContent: thinkingAcc || undefined, tokenUsage: usage },
                ]);
              },
            },
          );
        }
      } catch (error) {
        const fallback = buildFriendlyError(error);
        patchAssistantMessage(conversationId, assistantId, { content: fallback });
        await saveMessages(conversationId, [
          ...(messagesByConversation[conversationId] ?? []),
          userMessage,
          { ...assistantMessage, content: fallback },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [
      activeConversationId,
      activeImageModel,
      activeModel,
      addMessage,
      apiKey,
      createConversation,
      enableThinking,
      frequencyPenalty,
      generationMode,
      maxTokens,
      messagesByConversation,
      patchAssistantMessage,
      presencePenalty,
      saveMessages,
      setApiKeyModalOpen,
      setLastTokenUsage,
      setLoading,
      temperature,
      topP,
      userAvatarText,
      userName,
    ],
  );

  return useMemo(() => ({ sendMessage, loading }), [loading, sendMessage]);
}
