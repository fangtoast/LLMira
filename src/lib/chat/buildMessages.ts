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
import type { ChatAttachment, ChatMessage } from "@/types";

type ApiMsg = ChatCompletionRequest["messages"][number];

function getAttachmentImageUrls(message: Pick<ChatMessage, "attachments" | "imageUrls">) {
  const nextImages =
    message.attachments
      ?.filter((item) => item.kind === "image" && item.status === "ready" && item.dataUrl)
      .map((item) => item.dataUrl!) ?? [];
  return nextImages.length ? nextImages : (message.imageUrls ?? []);
}

function buildAttachmentText(attachments: ChatAttachment[] = []) {
  const blocks = attachments
    .filter((item) => item.status === "ready" && item.textContent)
    .map((item) => {
      const suffix = item.textTruncated ? "\n\n[内容过长，已截断]" : "";
      return `--- 文件内容: ${item.name} ---\n${item.textContent}${suffix}\n---`;
    });
  const unavailable = attachments.filter((item) => item.status !== "ready" && item.kind !== "image");
  if (unavailable.length) {
    blocks.push(`以下附件未读取正文，仅提供文件名: ${unavailable.map((item) => item.name).join(", ")}`);
  }
  return blocks.length ? `\n\n${blocks.join("\n\n")}` : "";
}

function withAttachmentText(content: string, attachments?: ChatAttachment[]) {
  return `${content}${buildAttachmentText(attachments)}`.trim();
}

/**
 * 将历史与本轮用户输入拼成 API `messages`（含本轮附件图片）。
 *
 * @param history 已持久化的会话消息（调用方已排除当前轮重复）
 * @param userContent 用户文本
 * @param attachments 本轮附加文件（含已解析正文与图片 data URL）
 */
export function buildApiMessagesFromChat(
  history: ChatMessage[],
  userContent: string,
  attachments: ChatAttachment[] = [],
): ApiMsg[] {
  const mapped: ApiMsg[] = history.map((item) => {
    const imageUrls = item.role === "user" ? getAttachmentImageUrls(item) : [];
    const text = item.role === "user" ? withAttachmentText(item.content, item.attachments) : item.content;
    return {
      role: item.role,
      content: imageUrls.length
        ? [
            { type: "text" as const, text },
            ...imageUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ]
        : text,
    };
  });

  const currentImageUrls = getAttachmentImageUrls({ attachments });
  const currentText = withAttachmentText(userContent, attachments);

  const userBlock: ApiMsg = {
    role: "user",
    content: currentImageUrls.length
      ? [
          { type: "text" as const, text: currentText },
          ...currentImageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        ]
      : currentText,
  };

  return [...mapped, userBlock];
}
