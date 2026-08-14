"use client";

/**
 * @project LLMira
 * @file src/components/modals/ApiKeyModal.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 缺失 Key 时快速补充当前 Provider 密钥
 * @description 密钥写入 Stronghold 或 Web 会话内存，不进入 localStorage。
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settingsStore";

/** 全局 API Key 配置对话框（受 store 的 `apiKeyModalOpen` 控制）。 */
export function ApiKeyModal() {
  const { apiKey, apiKeyModalOpen, apiProfiles, activeApiProfileId, setApiKeyModalOpen, saveActiveApiKey } = useSettingsStore();
  const [value, setValue] = useState("");
  const activeProfile = apiProfiles.find((item) => item.id === activeApiProfileId) ?? apiProfiles[0];

  useEffect(() => {
    if (apiKeyModalOpen) {
      setValue(apiKey);
    }
  }, [apiKeyModalOpen, apiKey]);

  return (
    <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
      <DialogContent>
        <h2 className="mb-1 text-lg font-semibold">{apiKey ? "更换 API Key" : "配置 API Key"}</h2>
        <p className="mb-3 text-xs text-muted-foreground">当前中转站：{activeProfile?.name ?? "默认"}</p>
        <p className="mb-4 text-sm text-muted-foreground">
          在所用 API 服务商控制台创建令牌后填入。Provider 地址和模型扫描请前往独立设置页。
        </p>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-..."
          type="password"
          autoComplete="off"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setApiKeyModalOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() => void saveActiveApiKey(value.trim()).then(() => setApiKeyModalOpen(false))}
          >
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
