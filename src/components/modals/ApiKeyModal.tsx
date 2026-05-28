"use client";

/**
 * @project LLMira
 * @file src/components/modals/ApiKeyModal.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 首次、缺失 Key 或侧栏设置中更换时填写并写入 settings store
 * @description 与 `useChat` 无 Key 时、侧栏「设置」打开弹窗联动。
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settingsStore";

/** 全局 API Key 配置对话框（受 store 的 `apiKeyModalOpen` 控制）。 */
export function ApiKeyModal() {
  const { apiKey, apiKeyModalOpen, setApiKeyModalOpen, setApiKey } = useSettingsStore();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (apiKeyModalOpen) {
      setValue(apiKey);
    }
  }, [apiKeyModalOpen, apiKey]);

  return (
    <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
      <DialogContent>
        <h2 className="mb-3 text-lg font-semibold">{apiKey ? "更换 API Key" : "配置 API Key"}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          在所用 API 服务商控制台创建令牌后填入。接口地址由环境变量 <code className="text-xs">NEXT_PUBLIC_API_BASE_URL</code>{" "}
          决定（未配置时默认慧言）。
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
            onClick={() => {
              setApiKey(value.trim());
              setApiKeyModalOpen(false);
            }}
          >
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
