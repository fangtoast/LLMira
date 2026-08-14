/**
 * @project LLMira
 * @file src/components/models/ModelIcon.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 使用从 Lobe Icons 官方静态包拣选的本地 SVG，避免把图标运行时打入首屏包。
 */
import { Box } from "lucide-react";
import type { ModelFamily } from "@/lib/models/catalog";
import { cn } from "@/lib/utils";

const MODEL_ICON_PATHS: Partial<Record<ModelFamily, string>> = {
  openai: "/model-icons/openai.svg",
  anthropic: "/model-icons/anthropic.svg",
  deepseek: "/model-icons/deepseek.svg",
  google: "/model-icons/google.svg",
  qwen: "/model-icons/qwen.svg",
  glm: "/model-icons/glm.svg",
  kimi: "/model-icons/kimi.svg",
  meta: "/model-icons/meta.svg",
};

/** 为模型家族渲染真实品牌标识，未知家族统一使用 Box。 */
export function ModelIcon({ family, size = 20 }: { family: ModelFamily; size?: number }) {
  const src = MODEL_ICON_PATHS[family];
  if (src) {
    // Lobe Icons SVG 是本地静态资源；保留原始品牌色和精确尺寸。
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" aria-hidden className={cn(["openai", "anthropic", "glm", "kimi"].includes(family) && "dark:invert")} style={{ width: size, height: size }} />;
  }
  return <Box aria-hidden style={{ width: size, height: size }} />;
}
