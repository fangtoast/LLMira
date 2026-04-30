# 设置与模型列表

## 功能描述

用户参数（API Key、当前模型、文生图模式、温度等）由 **Zustand + persist** 写入 **localStorage**；模型下拉数据来自 `GET /v1/models` 与可选环境变量 `NEXT_PUBLIC_MODEL_PRESET` 合并。

## 接口定义

| 模块 | 说明 |
|------|------|
| `useSettingsStore` | `src/lib/store/settingsStore.ts`，持久化字段见 `SettingsState` |
| `useModels` | `src/hooks/useModels.ts`，拉取并合并预设模型 id |

## 参数说明

- **generationMode**：`chat` | `image`，影响顶栏模型选择与请求分支。
- **enableThinking**：影响请求体 `reasoning_effort` 与 UI 思考区展示。
- **侧栏折叠**：`sidebarCollapsed` 同属 settings store。

## 调用示例

```ts
const activeModel = useSettingsStore((s) => s.activeModel);
const setActiveModel = useSettingsStore((s) => s.setActiveModel);
```

## 注意事项

- SSR 时使用内存 storage 占位，避免访问 `localStorage` 报错。
- API Key 脱敏展示与日志约束见工程规范。

## 维护记录

| 日期 | 说明 |
|------|------|
| 2026-04-30 | 初稿 |
