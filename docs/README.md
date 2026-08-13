<!--
  Purpose: LLMira 团队版文档入口
  Author: fangtoast <fangtoast@foxmail.com>
-->

# LLMira 文档索引

这里记录团队版的稳定架构、部署、安全和发布约定。旧版本地聊天模块仍留在源码中用于迁移兼容，其旧文档不再代表首发产品边界。

## 当前文档

| 文档 | 用途 |
| --- | --- |
| [工程架构](engineering/architecture.md) | 工作区、数据流、服务边界、状态机与代码目录 |
| [API 与安全边界](API与安全边界.md) | `/api/v1`、SSE、角色、密钥、MCP、SSRF 与审计 |
| [部署与恢复](部署与恢复.md) | Docker Compose、TLS、备份、恢复演练与健康检查 |
| [发布与打包](发布与打包.md) | Web、Windows x64、Android arm64 和签名前置条件 |
| [贡献指南](engineering/CONTRIBUTING.md) | 代码、日志、文件头、测试与提交规则 |

## 兼容资料

以下文档描述旧版客户端模块，仅用于迁移和维护：

| 文档 | 说明 |
| --- | --- |
| [旧流式对话](features/chat-streaming.md) | 旧客户端请求和停止行为 |
| [旧 Dexie 数据](features/persistence-dexie.md) | 迁移向导的数据来源 |
| [旧 API 客户端](features/api-client.md) | 被团队 API 边界替代的直接调用方式 |
| [旧设置与模型](features/settings-and-models.md) | 旧本地 Profile，仅用于迁移 |
| [Markdown 渲染](features/markdown-rendering.md) | 仍可复用的渲染模块 |

## 权威入口

- 运行命令与当前能力以根目录 [README](../README.md) 为准。
- Next.js 16 写法先查阅已安装版本的 `node_modules/next/dist/docs/`，再修改代码。
- 数据库结构以 [`001_team_platform.sql`](../infra/postgres/migrations/001_team_platform.sql) 为准。
- 跨端窗口、能力与安装包配置以 [`src-tauri`](../src-tauri) 为准。
