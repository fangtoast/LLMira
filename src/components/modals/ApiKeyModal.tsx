"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function ApiKeyModal() {
  const { apiKeyModalOpen, setApiKeyModalOpen, setApiKey } = useSettingsStore();
  const [value, setValue] = useState("");

  return (
    <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
      <DialogContent>
        <h2 className="mb-3 text-lg font-semibold">配置 API Key</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          在慧言 API 控制台创建令牌后，填入此处。Base URL 默认为 https://api.huiyan-ai.cn
        </p>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="sk-..." />
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
