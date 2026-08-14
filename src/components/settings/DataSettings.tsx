"use client";

/**
 * @project LLMira
 * @file src/components/settings/DataSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 全量备份、合并/覆盖恢复、设置重置与个人数据删除
 * @description 危险操作均需二次确认；备份只包含脱敏后的设置与 MCP 配置。
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FilePlus2, RefreshCcw, RotateCcw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { parseImportedFullBackupJson } from "@/lib/chat/exportImport";
import { clearSavedConversationId } from "@/lib/chat/lastConversationStorage";
import { deleteMcpSecrets } from "@/lib/mcp/secrets";
import { deleteProviderSecret } from "@/lib/providers/runtime";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useConversations } from "@/hooks/useConversations";
import { SettingsCard, SettingsPageHeader, SettingsRow } from "./SettingsPrimitives";

type RestoreMode = "merge" | "replace";

async function clearKnownSecrets() {
  const settings = useSettingsStore.getState();
  await Promise.all([
    ...settings.apiProfiles.map((profile) => deleteProviderSecret(profile.id)),
    deleteProviderSecret(`search:${settings.searchProvider}`),
    ...settings.mcpServers.map((server) => deleteMcpSecrets(server.id)),
  ]);
}

export function DataSettings() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreMode = useRef<RestoreMode>("merge");
  const [notice, setNotice] = useState("");
  const { exportFullBackupDownload, importFullBackupMerge, importFullBackupReplace } = useConversations();

  async function importBackup(file: File) {
    try {
      const backup = parseImportedFullBackupJson(await file.text());
      if (restoreMode.current === "replace") await importFullBackupReplace(backup);
      else await importFullBackupMerge(backup);
      setNotice(`已${restoreMode.current === "replace" ? "覆盖" : "合并"}恢复；MCP 秘密值需要重新填写。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "恢复失败");
    }
  }

  function chooseFile(mode: RestoreMode) {
    restoreMode.current = mode;
    inputRef.current?.click();
  }

  async function resetSettings() {
    await clearKnownSecrets();
    await useSettingsStore.persist.clearStorage();
    window.location.reload();
  }

  async function deleteAllData() {
    await clearKnownSecrets();
    const { db } = await import("@/lib/db/dexie");
    await db.transaction("rw", db.conversations, db.messages, async () => {
      await db.messages.clear();
      await db.conversations.clear();
    });
    clearSavedConversationId();
    await useSettingsStore.persist.clearStorage();
    router.push("/chat");
  }

  return (
    <div className="grid gap-6">
      <SettingsPageHeader title="数据" description="备份文件包含聊天、工具调用记录与非敏感设置，不包含 API Key、环境变量或敏感请求头。" />
      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.currentTarget.value = ""; }} />
      <SettingsCard title="数据备份与恢复">
        <SettingsRow title="全量备份" description="导出 version 3 JSON，可在其他 LLMira 设备恢复。" control={<Button variant="outline" onClick={() => void exportFullBackupDownload()}><Download className="mr-2 size-4" />备份</Button>} />
        <SettingsRow title="合并恢复" description="保留当前聊天和设置，追加备份内容。" control={<Button variant="outline" onClick={() => chooseFile("merge")}><FilePlus2 className="mr-2 size-4" />选择备份</Button>} />
        <SettingsRow title="覆盖恢复" description="用备份内容替换当前聊天与非敏感设置。" control={<Button variant="outline" onClick={() => chooseFile("replace")}><RefreshCcw className="mr-2 size-4" />覆盖恢复</Button>} />
        {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      </SettingsCard>
      <SettingsCard title="危险操作" description="这些操作无法通过应用内撤销。">
        <SettingsRow title="重置设置" description="清除 Provider、模型、搜索、外观和 MCP 设置，保留聊天记录。" control={<AlertDialog><AlertDialogTrigger asChild><Button variant="outline"><RotateCcw className="mr-2 size-4" />重置设置</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认重置全部设置？</AlertDialogTitle><AlertDialogDescription>聊天记录会保留，但设备密钥与 MCP 秘密值会被删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void resetSettings()}>确认重置</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>} />
        <SettingsRow title="删除全部个人数据" description="删除聊天记录、设置及已知设备秘密值。" control={<AlertDialog><AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 size-4" />删除数据</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>永久删除全部个人数据？</AlertDialogTitle><AlertDialogDescription>此操作会删除当前设备上的聊天、设置和秘密值，且无法恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void deleteAllData()}>永久删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>} />
      </SettingsCard>
    </div>
  );
}
