/**
 * @project LLMira
 * @file src/lib/chat/exportImport.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 会话 JSON 导出/解析、Markdown 与纯文本导出
 * @description 与侧栏导入导出联动；`version` 用于向后兼容。
 */
import type { ChatMessage, Conversation } from "@/types";
import { sanitizeMcpServerConfig, type AccentTheme, type ApiProfile, type ModelGenerationSettings, type SettingsState } from "@/lib/store/settingsStore";
import type { McpServerConfig } from "@/lib/mcp/types";
import type { UsageEvent } from "@/lib/usage/types";
import { sanitizeUsageEvent } from "@/lib/usage/sanitize";

const EXPORT_VERSION = 1 as const;

/** 全量多会话备份版本（与单会话 `ExportedChat` 的 version=1 区分）。 */
export const FULL_BACKUP_VERSION = 4 as const;

type BackupChats = Array<{
  conversation: Conversation & { keyword?: string };
  messages: ChatMessage[];
}>;

export type PersonalSettingsBackup = {
  apiProfiles: Array<Omit<ApiProfile, "apiKey">>;
  activeApiProfileId: string;
  activeModel: string;
  activeImageModel: string;
  webSearchMode: SettingsState["webSearchMode"];
  searchProvider: SettingsState["searchProvider"];
  searchBaseUrl: string;
  favoriteModelsByProvider: Record<string, string[]>;
  reasoningModeByProviderModel: SettingsState["reasoningModeByProviderModel"];
  translationModelByProviderId: Record<string, string>;
  modelSettingsById: Record<string, ModelGenerationSettings>;
  accentTheme: AccentTheme;
  cnyPerUsd?: number;
  pricingOverrides: SettingsState["pricingOverrides"];
  usageRangePreference: SettingsState["usageRangePreference"];
  usageHeatmapView: SettingsState["usageHeatmapView"];
  mcpServers: McpServerConfig[];
};

export type ExportedFullBackupV2 = {
  version: 2;
  exportedAt: number;
  chats: BackupChats;
};

export type ExportedFullBackupV3 = {
  version: 3;
  exportedAt: number;
  chats: BackupChats;
  settings: PersonalSettingsBackup;
};

export type ExportedFullBackupV4 = {
  version: 4;
  exportedAt: number;
  chats: BackupChats;
  settings: PersonalSettingsBackup;
  usageEvents: UsageEvent[];
};

export type ExportedFullBackup = ExportedFullBackupV2 | ExportedFullBackupV3 | ExportedFullBackupV4;

/** 单份可导入的会话快照结构。 */
export type ExportedChat = {
  version: typeof EXPORT_VERSION;
  exportedAt: number;
  conversation: Pick<Conversation, "title" | "model" | "createdAt" | "updatedAt">;
  messages: ChatMessage[];
};

/** 导出为带版本号的 JSON 字符串。 */
export function exportConversationJson(conv: Conversation, messages: ChatMessage[]): string {
  const payload: ExportedChat = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    conversation: {
      title: conv.title,
      model: conv.model,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    },
    messages,
  };
  return JSON.stringify(payload, null, 2);
}

/** Markdown 分段（用户/助手二级标题）。 */
export function exportConversationMarkdown(messages: ChatMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`## 用户\n\n${m.content}\n`);
    } else {
      lines.push(`## 助手\n\n${m.content}\n`);
    }
  }
  return lines.join("\n");
}

/** 纯文本 role + 分隔线。 */
export function exportConversationPlain(messages: ChatMessage[]): string {
  return messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n---\n\n");
}

/**
 * 校验版本与必填字段后返回结构化数据。
 *
 * @throws Error 格式或版本不兼容时
 */
/** 根据当前内存中的会话列表与消息映射生成全量备份对象。 */
export function buildFullBackupPayload(
  conversations: Conversation[],
  messagesByConversation: Record<string, ChatMessage[]>,
  settings: SettingsState,
  usageEvents: UsageEvent[] = [],
): ExportedFullBackupV4 {
  const chats = conversations.map((conversation) => ({
    conversation,
    messages: messagesByConversation[conversation.id] ?? [],
  }));
  return {
    version: FULL_BACKUP_VERSION,
    exportedAt: Date.now(),
    chats,
    settings: buildSettingsBackup(settings),
    usageEvents,
  };
}

/** 生成不含 Provider、搜索和 MCP 秘密值的可移植设置快照。 */
export function buildSettingsBackup(settings: SettingsState): PersonalSettingsBackup {
  return {
    apiProfiles: settings.apiProfiles.map((profile) => {
      const safeProfile: Partial<ApiProfile> = { ...profile };
      delete safeProfile.apiKey;
      return safeProfile as Omit<ApiProfile, "apiKey">;
    }),
    activeApiProfileId: settings.activeApiProfileId,
    activeModel: settings.activeModel,
    activeImageModel: settings.activeImageModel,
    webSearchMode: settings.webSearchMode,
    searchProvider: settings.searchProvider,
    searchBaseUrl: settings.searchBaseUrl,
    favoriteModelsByProvider: settings.favoriteModelsByProvider,
    reasoningModeByProviderModel: settings.reasoningModeByProviderModel,
    translationModelByProviderId: settings.translationModelByProviderId,
    modelSettingsById: settings.modelSettingsById,
    accentTheme: settings.accentTheme,
    cnyPerUsd: settings.cnyPerUsd,
    pricingOverrides: settings.pricingOverrides,
    usageRangePreference: settings.usageRangePreference,
    usageHeatmapView: settings.usageHeatmapView,
    mcpServers: settings.mcpServers.map((server) => sanitizeMcpServerConfig(server)),
  };
}

export function stringifyFullBackup(payload: ExportedFullBackup): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * 解析全量备份 JSON。
 *
 * @throws Error 格式或版本不兼容时
 */
export function parseImportedFullBackupJson(text: string): ExportedFullBackup {
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== "object") throw new Error("无效的 JSON");
  const o = data as Record<string, unknown>;
  if (o.version !== 2 && o.version !== 3 && o.version !== FULL_BACKUP_VERSION) throw new Error("不是受支持的全量备份文件（version 应为 2、3 或 4）");
  if (!Array.isArray(o.chats)) throw new Error("缺少 chats 数组");
  if ((o.version === 3 || o.version === 4) && (!o.settings || typeof o.settings !== "object")) throw new Error(`version ${o.version} 备份缺少 settings`);
  if (o.version === 4) {
    if (!Array.isArray(o.usageEvents)) throw new Error("version 4 备份缺少 usageEvents");
    return { ...(data as ExportedFullBackupV4), usageEvents: o.usageEvents.map(sanitizeUsageEvent).filter((event): event is UsageEvent => Boolean(event)) };
  }
  return data as ExportedFullBackup;
}

/** 触发浏览器下载 JSON 文件。 */
export function downloadJsonFile(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedChatJson(text: string): ExportedChat {
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== "object") throw new Error("无效的 JSON");
  const o = data as Record<string, unknown>;
  if (o.version !== EXPORT_VERSION) throw new Error("不支持的导出版本");
  if (!o.conversation || typeof o.conversation !== "object") throw new Error("缺少 conversation");
  if (!Array.isArray(o.messages)) throw new Error("缺少 messages 数组");
  return data as ExportedChat;
}
