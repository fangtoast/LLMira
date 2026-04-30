/**
 * @project LLMira
 * @file src/lib/chat/buildMessages.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 将会话历史与当前输入组装为 OpenAI `messages`
 * @description 供流式请求构造上下文；多模态用户消息展开为 text + image_url 片段。
 */
import type { ChatCompletionRequest } from "@/lib/api/types";
import type { ChatMessage } from "@/types";

type ApiMsg = ChatCompletionRequest["messages"][number];

/**
 * 将历史与本轮用户输入拼成 API `messages`（含本轮附件图片）。
 *
 * @param history 已持久化的会话消息（调用方已排除当前轮重复）
 * @param userContent 用户文本
 * @param imageDataUrls 本轮附加图片 data URL 列表
 */
export function buildApiMessagesFromChat(
  history: ChatMessage[],
  userContent: string,
  imageDataUrls: string[],
): ApiMsg[] {
  const mapped: ApiMsg[] = history.map((item) => ({
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
  }));

  const userBlock: ApiMsg = {
    role: "user",
    content: imageDataUrls.length
      ? [
          { type: "text" as const, text: userContent },
          ...imageDataUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        ]
      : userContent,
  };

  return [...mapped, userBlock];
}
