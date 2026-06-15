"use client";

/**
 * @project LLMira
 * @file src/components/chat/ModelMenu.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-06-15
 * @function
 *   - 暗色友好的模型选择菜单
 *   - 在顶栏与输入区复用模型切换 UI
 * @description 基于项目已有 Radix DropdownMenu 封装，避免原生 select 在暗色系统下低对比。
 */
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ModelMenuProps = {
  value: string;
  models: string[];
  onChange: (model: string) => void;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  label?: string;
};

/** 受控模型菜单，支持长模型名截断与当前项高亮。 */
export function ModelMenu({
  value,
  models,
  onChange,
  className,
  triggerClassName,
  align = "end",
  label = "选择模型",
}: ModelMenuProps) {
  const options = value && !models.includes(value) ? [value, ...models] : models;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={label}
        className={cn(
          "inline-flex h-9 min-w-0 max-w-[12rem] items-center gap-1 rounded-full bg-secondary/80 px-3 text-xs font-medium text-foreground outline-none ring-1 ring-border/70 transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/5 dark:hover:bg-white/10",
          triggerClassName,
        )}
      >
        <span className="min-w-0 truncate">{value || "模型加载中"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className={cn(
          "max-h-[min(24rem,70vh)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border-border/70 bg-card/95 p-1.5 text-card-foreground shadow-2xl shadow-black/30 backdrop-blur-xl dark:bg-[#242424]",
          className,
        )}
      >
        {options.length ? (
          options.map((model) => {
            const selected = model === value;
            return (
              <DropdownMenuItem
                key={model}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs text-foreground transition hover:bg-accent focus:bg-accent dark:hover:bg-white/10 dark:focus:bg-white/10",
                  selected && "bg-primary/12 text-primary dark:bg-white/[0.12] dark:text-zinc-50",
                )}
                onSelect={() => onChange(model)}
              >
                <span className="min-w-0 flex-1 truncate">{model}</span>
                {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </DropdownMenuItem>
            );
          })
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground">暂无模型</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
