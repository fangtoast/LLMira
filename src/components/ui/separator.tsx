/**
 * @project LLMira
 * @file src/components/ui/separator.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @description Radix Separator 横线分隔。
 */
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

export function Separator({ className, ...props }: SeparatorPrimitive.SeparatorProps) {
  return <SeparatorPrimitive.Root className={cn("h-px w-full bg-border", className)} {...props} />;
}
