"use client";

/**
 * @project LLMira
 * @file src/components/models/LazyModelLibrary.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 首次点击时再加载模型资料库与品牌图标，保护聊天首屏包体预算。
 */
import { useState, type ComponentType } from "react";
import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ModelLibraryProps } from "./ModelLibrary";

/** 延迟加载模型资料库；加载完成后保持组件实例以保留搜索与筛选状态。 */
export function LazyModelLibrary(props: ModelLibraryProps) {
  const [Loaded, setLoaded] = useState<ComponentType<ModelLibraryProps> | null>(null);
  if (Loaded) return <Loaded {...props} defaultOpen />;
  return (
    <Button type="button" variant="ghost" size="xs" className="max-w-[6rem] rounded-full sm:max-w-[11rem]" aria-label="选择模型" onClick={async () => {
      const importedLibrary = await import("./ModelLibrary");
      setLoaded(() => importedLibrary.ModelLibrary);
    }}>
      <span className="truncate">{props.value || "选择模型"}</span><ChevronUp aria-hidden />
    </Button>
  );
}
