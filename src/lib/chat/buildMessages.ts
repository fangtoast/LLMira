/**
 * @project LLMira
 * @file src/lib/chat/buildMessages.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-12
 * @function
 *   - 将会话历史与当前输入组装为 OpenAI `messages`
 * @description 供流式请求构造上下文；多模态用户消息展开为 text + image_url 片段。
 */
import type { ChatCompletionRequest } from "@/lib/api/types";
import type { ChatAttachment, ChatMessage } from "@/types";

type ApiMsg = ChatCompletionRequest["messages"][number];
const ATTACHMENT_CHUNK_SIZE = 12000;
const ATTACHMENT_MAX_TOTAL_CHARS = 400000;

function getAttachmentImageUrls(message: Pick<ChatMessage, "attachments" | "imageUrls">) {
  const nextImages =
    message.attachments
      ?.filter((item) => item.kind === "image" && item.status === "ready" && item.dataUrl)
      .map((item) => item.dataUrl!) ?? [];
  return nextImages.length ? nextImages : (message.imageUrls ?? []);
}

function splitTextIntoChunks(text: string, chunkSize: number) {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function buildAttachmentText(attachments: ChatAttachment[] = []) {
  const blocks: string[] = [];
  let remainingBudget = ATTACHMENT_MAX_TOTAL_CHARS;
  attachments
    .filter((item) => item.status === "ready" && item.textContent)
    .forEach((item) => {
      if (!item.textContent || remainingBudget <= 0) return;
      const limitedText = item.textContent.slice(0, remainingBudget);
      const chunks = splitTextIntoChunks(limitedText, ATTACHMENT_CHUNK_SIZE);
      const chunkBlocks = chunks.map((chunk, idx) =>
        [
          `--- 文件内容: ${item.name}（分块 ${idx + 1}/${chunks.length}） ---`,
          chunk,
          "---",
        ].join("\n"),
      );
      const budgetSuffix =
        limitedText.length < item.textContent.length
          ? `\n[附件内容过长，当前仅注入前 ${limitedText.length.toLocaleString()} 字符用于本轮回答]`
          : "";
      const originalTruncatedSuffix = item.textTruncated ? "\n[文件解析阶段曾发生截断]" : "";
      blocks.push(...chunkBlocks);
      if (budgetSuffix) blocks.push(budgetSuffix);
      if (originalTruncatedSuffix) blocks.push(originalTruncatedSuffix);
      remainingBudget -= limitedText.length;
    });
  const unavailable = attachments.filter((item) => item.status !== "ready" && item.kind !== "image");
  if (unavailable.length) {
    const lines = unavailable.map((item) => {
      const hint = item.errorMessage?.trim();
      return hint ? `${item.name} — ${hint}` : item.name;
    });
    blocks.push(["以下附件未读取正文（模型侧仅能看到文件名与下列说明）：", ...lines.map((l) => `- ${l}`)].join("\n"));
  }
  return blocks.length ? `\n\n${blocks.join("\n\n")}` : "";
}

function withAttachmentText(content: string, attachments?: ChatAttachment[]) {
  return `${content}${buildAttachmentText(attachments)}`.trim();
}

function getAssistantActiveSnapshot(message: ChatMessage) {
  if (message.role !== "assistant" || !message.variants?.length) {
    return {
      content: message.content,
    };
  }
  const fallbackIdx = message.variants.length - 1;
  const idx = Math.max(0, Math.min(fallbackIdx, message.activeVariantIdx ?? fallbackIdx));
  const selected = message.variants[idx];
  if (!selected) {
    return {
      content: message.content,
    };
  }
  return {
    content: selected.content,
  };
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
    const assistantSnapshot = getAssistantActiveSnapshot(item);
    const text = item.role === "user" ? withAttachmentText(item.content, item.attachments) : assistantSnapshot.content;
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
