"use client";

import { useEffect, useState } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useModels } from "@/hooks/useModels";

export function TopBar() {
  const { setTheme, resolvedTheme } = useTheme();
  const {
    activeModel,
    activeImageModel,
    generationMode,
    setActiveModel,
    setActiveImageModel,
  } = useSettingsStore();
  const models = useModels();
  const imageModels = models.filter((item) => /(image|mj|dall|flux|sd)/i.test(item));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-10 items-center justify-between bg-card/70 px-3 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold text-foreground">Huiyan-AI Pro</span>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          className="h-8 min-w-[180px] rounded-xl bg-card px-2 text-xs text-foreground outline-none ring-1 ring-border sm:min-w-[240px]"
          value={generationMode === "image" ? activeImageModel : activeModel}
          onChange={(e) =>
            generationMode === "image" ? setActiveImageModel(e.target.value) : setActiveModel(e.target.value)
          }
        >
          {(generationMode === "image" ? (imageModels.length ? imageModels : models) : models).map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {!mounted ? <Moon className="h-4 w-4" /> : resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
