/**
 * @project LLMira
 * @file src/lib/utils.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - Tailwind 类名合并（clsx + tailwind-merge）
 * @description shadcn/ui 惯例；避免冲突样式后者覆盖前者。
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并条件 className，解析 Tailwind 冲突。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
