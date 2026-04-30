# 本地持久化（Dexie）

## 功能描述

会话列表与消息保存在浏览器 **IndexedDB**（Dexie 封装），刷新页面后恢复当前会话与消息顺序；支持导出 JSON / Markdown / 文本及导入 JSON。

## 接口定义

| 符号 | 说明 |
|------|------|
| `db` | `src/lib/db/dexie.ts` 导出，数据库名 `llmira-db` |
| `useConversations()` | `loadMessages`、`saveMessages`、`createConversation`、`deleteConversation` 等 |
| `exportImport` | `src/lib/chat/exportImport.ts` 定义导入结构与类型 |

## 参数说明

- **表**：`conversations`（含可选 `keyword` 用于搜索）、`messages`（每条含 `conversationId`）。
- **排序**：加载时按 `createdAt` 升序，同毫秒再以 `id` 稳定排序（见 `useConversations.loadMessages`）。

## 调用示例

业务代码通常不直接操作 `db`，而是通过 `useConversations` 与 `useChatStore.setMessages` 同步。

## 注意事项

- 全量 `saveMessages` 会按会话删除后 `bulkPut`，大会话需注意性能与存储配额。
- 隐私：数据仅存本机，不上传至 LLMira 服务器。

## 维护记录

| 日期 | 说明 |
|------|------|
| 2026-04-30 | 初稿 |
