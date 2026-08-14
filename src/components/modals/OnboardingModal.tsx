"use client";

/**
 * @project LLMira
 * @file src/components/modals/OnboardingModal.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 首次启动直接完成 Provider 连接与模型扫描，不再要求团队服务器。
 */
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProviderSetupForm } from "@/components/settings/ProviderSetupForm";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function OnboardingModal() {
  const completed = useSettingsStore((state) => state.hasCompletedOnboarding);
  return <Dialog open={!completed} onOpenChange={() => undefined}><DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-[28px]"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">首次设置 · 约 1 分钟</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">连接你的第一个 AI Provider</h2><p className="mb-6 mt-2 text-sm leading-6 text-muted-foreground">LLMira 会调用真实的 `/v1/models`。扫描成功并明确保存后，你就能选择 GPT、Claude、DeepSeek 等网关返回的模型。</p><ProviderSetupForm compact /></DialogContent></Dialog>;
}
