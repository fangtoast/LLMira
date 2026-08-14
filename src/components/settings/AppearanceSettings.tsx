"use client";

/**
 * @project LLMira
 * @file src/components/settings/AppearanceSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 主题模式与 LLMira 强调色设置
 * @description 选择立即写入根节点并由 next-themes 与设置存储持久化。
 */
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useSettingsStore, type AccentTheme } from "@/lib/store/settingsStore";
import { cn } from "@/lib/utils";
import { SettingsCard, SettingsPageHeader } from "./SettingsPrimitives";

const themes = [
  { id: "light", label: "浅色", Icon: Sun, preview: "bg-[#f5f7fb]" },
  { id: "dark", label: "深色", Icon: Moon, preview: "bg-[#111318]" },
  { id: "system", label: "跟随系统", Icon: Monitor, preview: "bg-gradient-to-r from-[#f5f7fb] from-50% to-[#111318] to-50%" },
] as const;

const accents: Array<{ id: AccentTheme; label: string; color: string }> = [
  { id: "blue", label: "远空蓝", color: "bg-blue-500" },
  { id: "cyan", label: "湖水青", color: "bg-cyan-500" },
  { id: "violet", label: "暮光紫", color: "bg-violet-500" },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const accentTheme = useSettingsStore((state) => state.accentTheme);
  const setAccentTheme = useSettingsStore((state) => state.setAccentTheme);

  function chooseAccent(accent: AccentTheme) {
    setAccentTheme(accent);
    window.dispatchEvent(new Event("llmira-accent"));
  }

  return (
    <div className="grid gap-6">
      <SettingsPageHeader title="外观" description="主题与强调色会立即应用到桌面、Web 和移动端界面。" />
      <SettingsCard title="主题">
        <div className="grid gap-3 sm:grid-cols-3">
          {themes.map(({ id, label, Icon, preview }) => (
            <button key={id} type="button" onClick={() => setTheme(id)} className={cn("rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", theme === id ? "border-primary ring-1 ring-primary" : "border-border/70 hover:border-foreground/25")}>
              <span className={cn("block h-28 rounded-lg border border-border/60", preview)} />
              <span className="mt-3 flex items-center justify-center gap-2 text-sm font-medium"><Icon className="size-4" />{label}{theme === id ? <Check className="size-4 text-primary" /> : null}</span>
            </button>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title="LLMira 主题色" description="使用有限的品牌色，避免影响内容可读性。">
        <div className="flex flex-wrap gap-3">
          {accents.map((accent) => <Button key={accent.id} variant={accentTheme === accent.id ? "default" : "outline"} onClick={() => chooseAccent(accent.id)}><span className={cn("mr-2 size-3 rounded-full", accent.color)} />{accent.label}</Button>)}
        </div>
      </SettingsCard>
    </div>
  );
}
