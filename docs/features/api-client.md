# API 客户端（慧言 OpenAI 兼容）

## 功能描述

`src/lib/api/client.ts` 封装对配置基址的 HTTP 调用：`streamChatCompletion`（对话流）、`generateImage`（文生图），以及 `GET /v1/models` 的模型列表拉取（见 `useModels` 与 `parseModelsResponse`）。

## 接口定义

| 函数 | 行为 |
|------|------|
| `streamChatCompletion` | POST `/v1/chat/completions`，`stream: true`，按行解析 SSE |
| `generateImage` | POST `/v1/images/generations` |
| `listModelIds` / 相关 | 从 models 响应提取 id 列表（`parseModelsResponse`） |

## 参数说明

- **鉴权**：`Authorization: Bearer <apiKey>`，由 `getHeaders` 统一处理；无 key 时抛 `MissingApiKeyError`。
- **超时**：流式请求可带 `signal` 与内部超时控制（见 `StreamRequestOptions`）。
- **日志**：关键路径打 `[Request Model]`、`[Stream Start]`、`[Token Count]` 等（经 `logger`）。

## 调用示例

```ts
await streamChatCompletion(apiKey, { model, messages, ... }, { onToken, onDone, ... }, { signal });
```

## 注意事项

- 响应非 2xx 时读取 body 片段拼入 Error，便于排查。
- 勿在客户端日志中输出完整 API Key。

## 维护记录

| 日期 | 说明 |
|------|------|
| 2026-04-30 | 初稿 |
