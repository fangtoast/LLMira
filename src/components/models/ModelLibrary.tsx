"use client";

/**
 * @project LLMira
 * @file src/components/models/ModelLibrary.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 桌面双栏 Popover 与移动全宽 Sheet 模型资料库
 *   - 搜索、家族筛选、收藏、键盘选择
 * @description 收藏写入当前 Provider 独立命名空间，收藏按钮不触发模型切换。
 */
import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronUp, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMdUp } from "@/hooks/useMediaQuery";
import { useModelCatalog } from "@/hooks/useModels";
import { groupModelPresentations, MODEL_FAMILIES, type ModelFamily } from "@/lib/models/catalog";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { cn } from "@/lib/utils";
import { ModelIcon } from "./ModelIcon";

export type ModelLibraryProps = {
  value: string;
  onChange: (model: string) => void;
  trigger?: ReactNode;
  capability?: "chat" | "imageGeneration";
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
};

const capabilityLabels = [
  ["vision", "视觉"],
  ["reasoning", "推理"],
  ["nativeWebSearch", "联网"],
] as const;

/** 响应式模型选择器，默认触发器显示当前模型。 */
export function ModelLibrary({ value, onChange, trigger, capability = "chat", side = "top", align = "center", defaultOpen = false }: ModelLibraryProps) {
  const isDesktop = useIsMdUp();
  const catalog = useModelCatalog();
  const activeProviderId = useSettingsStore((state) => state.activeApiProfileId);
  const toggleFavoriteModel = useSettingsStore((state) => state.toggleFavoriteModel);
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "favorites">("all");
  const [family, setFamily] = useState<"all" | ModelFamily>("all");

  const available = useMemo(
    () => catalog.filter((model) => model.capabilities[capability]),
    [capability, catalog],
  );
  const sections = useMemo(() => {
    const grouped = groupModelPresentations(available, mode, query);
    return family === "all" ? grouped : grouped.map((section) => ({ ...section, models: section.models.filter((model) => model.family === family) })).filter((section) => section.models.length);
  }, [available, family, mode, query]);
  const visibleFamilies = MODEL_FAMILIES.filter(({ id }) => available.some((model) => model.family === id));

  const choose = (model: string) => {
    onChange(model);
    setOpen(false);
  };

  const content = (
    <Command shouldFilter={false} className="h-full bg-card" onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
    }}>
      <div className="flex items-center gap-2 border-b p-3 max-sm:pr-12">
        <div className="min-w-0 flex-1"><CommandInput value={query} onValueChange={setQuery} placeholder="搜索模型、ID 或家族" /></div>
        <ToggleGroup type="single" value={mode} onValueChange={(next) => { if (next) setMode(next as "all" | "favorites"); }} variant="outline" size="sm" aria-label="模型显示范围">
          <ToggleGroupItem value="all">全部</ToggleGroupItem>
          <ToggleGroupItem value="favorites">收藏</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[156px_minmax(0,1fr)] max-sm:grid-cols-1">
        <div className="flex flex-col gap-1 border-r p-2 max-sm:hidden">
          <button type="button" onClick={() => setFamily("all")} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground", family === "all" && "bg-primary/12 text-primary")}>
            <Star aria-hidden className="size-4" />全部家族
          </button>
          {visibleFamilies.map((item) => (
            <button key={item.id} type="button" onClick={() => setFamily(item.id)} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground", family === item.id && "bg-primary/12 text-primary")}>
              <ModelIcon family={item.id} size={18} /><span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
        <CommandList className="max-h-[430px] p-2 max-sm:max-h-[calc(100dvh-9rem)]">
          <CommandEmpty>没有找到匹配的模型</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup key={section.id} heading={section.label}>
              {section.models.map((model) => (
                <CommandItem key={model.id} value={`${model.name} ${model.id} ${model.familyLabel}`} onSelect={() => choose(model.id)} className={cn("gap-3", model.id === value && "bg-primary/10")}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary"><ModelIcon family={model.family} size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{model.name}</span>
                    {model.id !== model.name ? <span className="block truncate text-xs text-muted-foreground">{model.id}</span> : null}
                  </span>
                  <span className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:flex">
                    {capabilityLabels.map(([key, label]) => model.capabilities[key] ? <span key={key}>{label}</span> : null)}
                  </span>
                  {model.id === value ? <Check aria-label="当前模型" className="size-4 shrink-0 text-primary" /> : null}
                  <button type="button" aria-label={model.favorite ? `取消收藏 ${model.name}` : `收藏 ${model.name}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-primary" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleFavoriteModel(activeProviderId, model.id);
                  }}>
                    <Star className={cn("size-4", model.favorite && "fill-primary text-primary")} />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </div>
    </Command>
  );

  const defaultTrigger = (
    <Button type="button" variant="ghost" size="xs" className="max-w-[11rem] rounded-full" aria-label="选择模型">
      <span className="truncate">{value || "选择模型"}</span><ChevronUp aria-hidden />
    </Button>
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger ?? defaultTrigger}</PopoverTrigger>
        <PopoverContent side={side} align={align} sideOffset={12} className="h-[min(520px,70vh)] w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl border-border/70 bg-card/98 p-0 shadow-2xl">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger ?? defaultTrigger}</SheetTrigger>
      <SheetContent side="bottom" className="h-dvh w-full max-w-none overflow-hidden p-0">
        <SheetTitle className="sr-only">选择模型</SheetTitle>
        {content}
      </SheetContent>
    </Sheet>
  );
}
