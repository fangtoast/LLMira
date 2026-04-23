"use client";

import { useEffect, useState } from "react";
import { fetchModels } from "@/lib/api/client";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function useModels() {
  const { apiKey } = useSettingsStore();
  const [models, setModels] = useState<string[]>(["gpt-5-chat"]);

  useEffect(() => {
    if (!apiKey) return;
    fetchModels(apiKey)
      .then((res) => {
        const ids = res.data.map((item) => item.id);
        if (ids.length) setModels(ids);
      })
      .catch(() => setModels(["gpt-5-chat"]));
  }, [apiKey]);

  return models;
}
