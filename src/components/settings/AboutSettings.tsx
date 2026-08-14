"use client";

/**
 * @project LLMira
 * @file src/components/settings/AboutSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 显示应用版本、平台与帮助链接
 * @description 首轮不暴露没有发布后端支撑的自动更新入口。
 */
import { useSyncExternalStore } from "react";
import { Code2, ExternalLink, HeartHandshake } from "lucide-react";
import packageInfo from "../../../package.json";
import { Button } from "@/components/ui/button";
import { SettingsCard, SettingsPageHeader, SettingsRow } from "./SettingsPrimitives";

export function AboutSettings() {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const platform = mounted ? (/Android/i.test(navigator.userAgent) ? "Android" : "Windows / Web") : "Web";
  return (
    <div className="grid gap-6">
      <SettingsPageHeader title="关于 LLMira" description="面向个人用户的 BYOK 多模型工作台。" />
      <SettingsCard title="应用信息">
        <div className="flex items-center gap-4 border-b border-border/60 pb-5">
          <span className="grid size-14 place-items-center rounded-xl bg-primary text-xl font-black text-primary-foreground">M</span>
          <div><p className="text-lg font-semibold">LLMira</p><p className="text-sm text-muted-foreground">个人 AI 工作台</p></div>
        </div>
        <SettingsRow title="版本" control={<span className="text-sm text-muted-foreground">v{packageInfo.version}</span>} />
        <SettingsRow title="运行平台" control={<span className="text-sm text-muted-foreground">{platform}</span>} />
        <SettingsRow title="构建类型" control={<span className="text-sm text-muted-foreground">Developer Preview</span>} />
      </SettingsCard>
      <SettingsCard title="帮助与项目">
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline"><a href="https://github.com/fangtoast/LLMira" target="_blank" rel="noreferrer"><Code2 className="mr-2 size-4" />GitHub<ExternalLink className="ml-2 size-3" /></a></Button>
          <Button asChild variant="outline"><a href="https://github.com/fangtoast/LLMira#readme" target="_blank" rel="noreferrer"><HeartHandshake className="mr-2 size-4" />帮助文档<ExternalLink className="ml-2 size-3" /></a></Button>
        </div>
      </SettingsCard>
    </div>
  );
}
