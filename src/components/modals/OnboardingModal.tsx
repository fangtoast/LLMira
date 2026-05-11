"use client";

/**
 * @project LLMira
 * @file src/components/modals/OnboardingModal.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-11
 * @function
 *   - 首次进入对话前设置昵称、头像文字与基础模型参数
 * @description 完成后写入 `settingsStore` 并持久化，后续启动不再弹出。
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/lib/store/settingsStore";

/** 首次使用引导：先确认称呼，再设置模型调用参数。 */
export function OnboardingModal() {
  const {
    apiKey,
    activeModel,
    hasCompletedOnboarding,
    maxTokens,
    setActiveModel,
    setApiKey,
    setHasCompletedOnboarding,
    setMaxTokens,
    setTemperature,
    setUserAvatarText,
    setUserName,
    temperature,
    userAvatarText,
    userName,
  } = useSettingsStore();
  const [step, setStep] = useState<"profile" | "model">("profile");
  const [draftName, setDraftName] = useState(userName || "Xiao");
  const [draftAvatar, setDraftAvatar] = useState(userAvatarText || "潇");
  const [draftApiKey, setDraftApiKey] = useState(apiKey);
  const [draftModel, setDraftModel] = useState(activeModel);
  const [draftTemperature, setDraftTemperature] = useState(String(temperature));
  const [draftMaxTokens, setDraftMaxTokens] = useState(String(maxTokens));

  const complete = () => {
    const normalizedName = draftName.trim() || "Xiao";
    const normalizedAvatar = (draftAvatar.trim() || normalizedName.slice(0, 2) || "潇").slice(0, 2);
    const parsedTemperature = Number.parseFloat(draftTemperature);
    const parsedMaxTokens = Number.parseInt(draftMaxTokens, 10);

    setUserName(normalizedName);
    setUserAvatarText(normalizedAvatar);
    setApiKey(draftApiKey.trim());
    setActiveModel(draftModel.trim() || activeModel);
    if (Number.isFinite(parsedTemperature)) setTemperature(Math.min(2, Math.max(0, parsedTemperature)));
    if (Number.isFinite(parsedMaxTokens)) setMaxTokens(Math.max(1, parsedMaxTokens));
    setHasCompletedOnboarding(true);
  };

  return (
    <Dialog open={!hasCompletedOnboarding} onOpenChange={() => undefined}>
      <DialogContent className="max-w-xl">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">首次设置</p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">开始前，先配置你的对话偏好</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            昵称会用于页面问候和用户消息显示；模型参数会作为之后对话的默认请求参数。
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-muted/50 p-1 text-sm">
          <button
            type="button"
            className={`rounded-full px-3 py-2 ${step === "profile" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setStep("profile")}
          >
            1. 昵称
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-2 ${step === "model" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setStep("model")}
          >
            2. 模型参数
          </button>
        </div>

        {step === "profile" ? (
          <div className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">你的昵称</span>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="例如：Xiao" />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">头像文字</span>
              <Input
                value={draftAvatar}
                onChange={(e) => setDraftAvatar(e.target.value.slice(0, 2))}
                placeholder="1-2 个字"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">API Key（可稍后再填）</span>
              <Input value={draftApiKey} onChange={(e) => setDraftApiKey(e.target.value)} placeholder="sk-..." />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">对话模型</span>
              <Input value={draftModel} onChange={(e) => setDraftModel(e.target.value)} placeholder="gpt-5.5" />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="flex items-center justify-between font-medium text-foreground">
                <span>Temperature</span>
                <span className="text-xs text-muted-foreground">{draftTemperature}</span>
              </span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={draftTemperature}
                onChange={(e) => setDraftTemperature(e.target.value)}
                className="w-full"
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">Max Tokens</span>
              <Input
                type="number"
                min={1}
                value={draftMaxTokens}
                onChange={(e) => setDraftMaxTokens(e.target.value)}
                placeholder="4096"
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          {step === "model" ? (
            <Button type="button" variant="outline" onClick={() => setStep("profile")}>
              上一步
            </Button>
          ) : null}
          {step === "profile" ? (
            <Button type="button" onClick={() => setStep("model")}>
              下一步
            </Button>
          ) : (
            <Button type="button" onClick={complete}>
              开始对话
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
