"use client";

/**
 * @project LLMira
 * @file src/components/settings/DefaultModelsSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 集中管理默认聊天、图像、翻译模型与生成参数
 * @description 只展示真实扫描到的 Provider 模型目录。
 */
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { SettingsCard, SettingsPageHeader, SettingsRow } from "./SettingsPrimitives";

export function DefaultModelsSettings() {
  const store = useSettingsStore();
  const profile = store.getActiveApiProfile();
  const chatModels = profile.modelCatalog.filter((model) => model.capabilities.chat);
  const imageModels = profile.modelCatalog.filter((model) => model.capabilities.imageGeneration);
  const translationModel = store.translationModelByProviderId[profile.id] ?? "";
  const reasoningMode = store.reasoningModeByProviderModel[profile.id]?.[store.activeModel] ?? "auto";
  const parameters = store.modelSettingsById[store.activeModel] ?? {
    temperature: store.temperature,
    topP: store.topP,
    maxTokens: store.maxTokens,
    presencePenalty: store.presencePenalty,
    frequencyPenalty: store.frequencyPenalty,
  };

  const modelSelect = (value: string, onValueChange: (value: string) => void, models: typeof profile.modelCatalog, placeholder: string) => (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className="w-full sm:min-w-64"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{models.map((model) => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="grid gap-6">
      <SettingsPageHeader title="默认模型" description={`当前模型目录来自 ${profile.name}，切换 Provider 后会使用对应的真实扫描结果。`} />
      <SettingsCard title="默认模型">
        <SettingsRow title="默认聊天模型" description="新建对话时优先使用。" control={modelSelect(store.activeModel, store.setActiveModel, chatModels, "请先扫描对话模型")} />
        <SettingsRow title="默认图像模型" description="图像工作台的默认生成模型。" control={modelSelect(store.activeImageModel, store.setActiveImageModel, imageModels, "未扫描到图像模型")} />
        <SettingsRow title="默认翻译模型" description="翻译工作台使用的对话模型。" control={modelSelect(translationModel, (value) => store.setTranslationModel(profile.id, value), chatModels, "选择翻译模型")} />
      </SettingsCard>
      <SettingsCard title="推理与生成参数" description={`参数仅应用于 ${store.activeModel || "当前模型"}。`}>
        <SettingsRow
          title="推理强度"
          description="支持推理的模型会使用该级别；不支持时不会发送 reasoning_effort。"
          control={<Select value={reasoningMode} onValueChange={(value) => store.setReasoningMode(profile.id, store.activeModel, value as "auto" | "low" | "medium" | "high")}><SelectTrigger className="w-full sm:min-w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">自动</SelectItem><SelectItem value="low">快速</SelectItem><SelectItem value="medium">均衡</SelectItem><SelectItem value="high">深度</SelectItem></SelectContent></Select>}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["Temperature", "temperature", 0, 2, 0.1],
            ["Top P", "topP", 0, 1, 0.05],
            ["最大输出 Token", "maxTokens", 1, 200000, 1],
            ["Presence Penalty", "presencePenalty", -2, 2, 0.1],
            ["Frequency Penalty", "frequencyPenalty", -2, 2, 0.1],
          ] as const).map(([label, key, min, max, step]) => (
            <label key={key} className="grid gap-2 text-sm font-medium">
              {label}
              <Input type="number" min={min} max={max} step={step} value={parameters[key]} onChange={(event) => store.updateCurrentModelSettings({ [key]: Number(event.target.value) })} />
            </label>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
