# 本地持久化（Dexie）

## 功能描述

会话列表与消息保存在浏览器 **IndexedDB**（Dexie 封装）。应用启动时通过 **`bootstrapSessionFromIndexedDb`**（`src/lib/chat/bootstrapSession.ts`）一次性从 IndexedDB 拉取会话列表、恢复**上次打开的会话**（`localStorage` 键 `llmira-last-conversation-id`，见 `lastConversationStorage.ts`），并加载该会话消息；刷新后列表与当前会话应与刷新前一致。侧栏支持单会话 JSON / Markdown / 文本导出与 JSON 导入；另支持 **全量备份 JSON**（多会话，`exportImport` 中 `version: 2`）与合并 / 替换导入。

## 同源、主机与端口（为何「换地址就像没了对话」）

IndexedDB 与 `localStorage` 均绑定浏览器的**源（origin）**：**协议 + 主机名 + 端口**。下列情况会视为**不同库**，数据互不共享：

- 开发时端口从 `3000` 改成 `3001`；
- `http://localhost:3000` 与 `http://127.0.0.1:3000`（主机不同）；
- `http` 与 `https`。

**建议**：本地开发固定使用同一 URL（例如始终 `http://localhost:3000`）。重启 `npm run dev` **不会**单独清空 IndexedDB；若对话「不见了」，先核对是否换了端口或主机。

用户若在浏览器设置中**清除站点数据**，本会话的 IndexedDB 与本地存储会被删掉。

## 接口定义

| 符号 | 说明 |
|------|------|
| `db` | `src/lib/db/dexie.ts` 导出，数据库名 `llmira-db` |
| `bootstrapSessionFromIndexedDb` | 启动引导：列表 + 上次会话 + 消息；结束前将 store `hydrated` 置为 `true` |
| `useConversations()` | `loadMessages`、`saveMessages`、`createConversation`、`deleteConversation`、`exportFullBackupDownload`、`importFullBackupMerge` / `Replace` 等 |
| `exportImport` | `src/lib/chat/exportImport.ts`：单会话 `version: 1`；全量备份 `FULL_BACKUP_VERSION === 2` |

## 参数说明

- **表**：`conversations`（含可选 `keyword` 用于搜索）、`messages`（每条含 `conversationId`）。
- **排序**：加载时按 `createdAt` 升序，同毫秒再以 `id` 稳定排序（见 `useConversations.loadMessages`）。
- **`hydrated`**：`chatStore` 中标明 IndexedDB 引导是否完成；引导完成前 UI 可显示占位，避免空白欢迎页闪烁。

## 全量备份与恢复策略

- **导出**：侧栏「全量备份」从 IndexedDB 读取**全部**会话与消息写入单个 JSON（与仅导出当前内存中已加载消息不同）。
- **导入**：选择「导入全量」后：
  - **合并**：为备份内每个会话生成新 id，追加到现有库，保留本地已有会话；
  - **替换**：清空本地 `conversations` / `messages` 后按备份写回，随后重新执行引导（与刷新后状态一致）。

导入前请确认文件来源可信；替换操作不可撤销，建议先另行导出当前库备份。

## 删除会话

- **单条消息**：消息气泡内删除。
- **整条会话**：侧栏列表项删除，或主区顶栏垃圾桶按钮删除当前会话（均有确认或需在侧栏交互避免误触）。

删除当前会话后，`lastConversationId` 会随新的活跃会话更新或由 store 订阅清空（见 `chatStore` 对 `activeConversationId` 的订阅）。

## 调用示例

业务代码通常不直接操作 `db`，而是通过 `useConversations` 与 `useChatStore.setMessages` 同步。

## 注意事项

- 全量 `saveMessages` 会按会话删除后 `bulkPut`，大会话需注意性能与存储配额。
- 隐私：对话内容仅存本机 IndexedDB，不上传至 LLMira 服务器（API Key 等在其它存储，参见 settings 文档）。

## 维护记录

| 日期 | 说明 |
|------|------|
| 2026-04-30 | 初稿 |
| 2026-04-30 | 补充启动引导、上次会话、同源端口、全量备份与删除说明 |
