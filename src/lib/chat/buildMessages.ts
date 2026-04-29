import type { ChatCompletionRequest } from "@/lib/api/types";
import type { ChatMessage } from "@/types";

type ApiMsg = ChatCompletionRequest["messages"][number];

/** 将历史 + 当前用户消息拼成 OpenAI 协议 messages */
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
