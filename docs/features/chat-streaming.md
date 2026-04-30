# 流式对话（SSE）

## 功能描述

用户在输入框发送消息后，调用 OpenAI 兼容的 Chat Completions 接口，通过 **SSE** 流式接收助手回复；支持中止请求（Abort）、可选「深度思考」推理 token、文生图分支走独立接口。

## 接口定义

| 符号 | 类型 | 说明 |
|------|------|------|
| `streamChatCompletion` | `(apiKey, body, callbacks, options?) => Promise<void>` | 定义于 `src/lib/api/client.ts`，解析 `data: {...}` 行并回调 token |
| `useChat().sendMessage` | `(payload: { text, imageDataUrls? }) => Promise<void>` | 组装 user/assistant 消息并驱动流式或图生 |
| `buildApiMessagesFromChat` | 见 `src/lib/chat/buildMessages.ts` | 将当前会话历史裁剪为 API `messages` 数组 |

## 参数说明

- **中止**：`AbortController` 存于 `useChat` 内，切换会话或用户点击停止时 `abort()`。
- **深度思考**：请求体带 `reasoning_effort`（由 `enableThinking` 控制）；流中通过 `extractReasoningToken` 解析多种 delta 字段。
- **环境**：`NEXT_PUBLIC_API_BASE_URL` 作为 API 根路径。

## 调用示例

逻辑入口为页面装配的 `useChat()`，业务侧直接调用：

```ts
await sendMessage({ text: "你好", imageDataUrls: [] });
```

## 注意事项

- 无 API Key 时应弹出配置弹窗而非静默失败（由 `useChat` 与 store 协作）。
- 流解析单行 JSON 失败时使用 `logger.exception` 记录，不阻断整条流。

## 维护记录

| 日期 | 说明 |
|------|------|
| 2026-04-30 | 初稿 |
