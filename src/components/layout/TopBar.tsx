"use client";

/**
 * @project LLMira
 * @file src/components/layout/TopBar.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 品牌、模型下拉、主题切换、移动端菜单入口
 * @description 模型列表来自 `useModels`；宽度需避免挤压 logo。
 */
import { useEffect, useState } from "react";
import { Menu, Moon, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useModels } from "@/hooks/useModels";
import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type TopBarProps = {
  /** 打开移动端侧栏时的回调 */
  onOpenMobileMenu?: () => void;
  /** 当前会话 id（与 hydrated 同时满足时才展示删除入口） */
  activeConversationId?: string | null;
  /** IndexedDB 引导完成 */
  hydrated?: boolean;
  /** 删除当前会话（由外层弹出确认框并调用 Dexie 删除） */
  onDeleteCurrentConversation?: () => void;
};

/** 顶栏：品牌区 + 模型选择 + 明暗切换。 */
export function TopBar({
  onOpenMobileMenu,
  activeConversationId,
  hydrated,
  onDeleteCurrentConversation,
}: TopBarProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const {
    activeModel,
    activeImageModel,
    generationMode,
    setActiveModel,
    setActiveImageModel,
  } = useSettingsStore();
  const models = useModels();
  const imageModels = models.filter((item) => /(image|mj|dall|flux|sd|gpt-image)/i.test(item));
  const modelOptions = generationMode === "image" ? (imageModels.length > 0 ? imageModels : models) : models;
  const currentModel = generationMode === "image" ? activeImageModel : activeModel;
  const selectValue = currentModel
    ? modelOptions.includes(currentModel)
      ? currentModel
      : currentModel
    : (modelOptions[0] ?? "");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectClass = cn(
    "h-8 w-full min-w-0 max-w-[9.5rem] rounded-xl bg-card px-1.5 text-xs text-foreground outline-none ring-1 ring-border sm:max-w-[12rem] md:max-w-[14rem] lg:max-w-[16rem]",
  );

  if (!mounted) {
    return (
      <header className="sticky top-0 z-20 flex h-11 min-w-0 items-center gap-1.5 bg-card/70 px-3 sm:gap-2 sm:px-5 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.05)]">
        {onOpenMobileMenu ? (
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 md:hidden" disabled aria-label="打开菜单">
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_ICON_PATH} alt={BRAND_NAME} className="h-6 w-6 shrink-0 rounded-md" />
          <span className="max-w-[4.5rem] truncate text-sm font-semibold text-foreground sm:max-w-none">
            {BRAND_NAME}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
          <select className={selectClass} value="" disabled aria-label="模型加载中">
            <option value="">模型加载中...</option>
          </select>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-accent" disabled>
            <Moon className="h-4 w-4" />
          </Button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex h-11 min-w-0 items-center gap-1.5 bg-card/70 px-3 sm:gap-2 sm:px-5 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.05)]">
      {onOpenMobileMenu ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 md:hidden"
          onClick={onOpenMobileMenu}
          aria-label="打开侧栏与历史"
        >
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_ICON_PATH} alt={BRAND_NAME} className="h-6 w-6 shrink-0 rounded-md" />
        <span className="min-w-0 max-w-[4.5rem] truncate text-sm font-semibold text-foreground sm:max-w-[10rem] lg:max-w-none">
          {BRAND_NAME}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <select
          className={selectClass}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (generationMode === "image") setActiveImageModel(v);
            else setActiveModel(v);
          }}
        >
          {currentModel && !modelOptions.includes(currentModel) ? (
            <option key={currentModel} value={currentModel}>
              {currentModel}（不在当前列表）
            </option>
          ) : null}
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        {hydrated && activeConversationId && onDeleteCurrentConversation ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            onClick={onDeleteCurrentConversation}
            aria-label="删除当前会话"
            title="删除当前会话"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-accent"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
