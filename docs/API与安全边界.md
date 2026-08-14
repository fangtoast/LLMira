<!--
  Purpose: LLMira 团队 API 与安全控制说明
  Author: fangtoast <fangtoast@foxmail.com>
-->

# API 与安全边界

本文是客户端、API、Worker 和运维之间的稳定协议摘要，不包含具体模型供应商的私有配置。

## 接口族

| 路径 | 用途 |
| --- | --- |
| `/api/v1/bootstrap` | 首位组织管理员初始化；只能成功一次 |
| `/api/v1/auth/*` | 登录、刷新、退出和邀请接受 |
| `/api/v1/workspaces` | 当前用户可访问工作区 |
| `/api/v1/providers` | 团队或个人 Provider；响应不含密钥 |
| `/api/v1/documents` | 知识文档登记和摄取状态 |
| `/api/v1/runs` | Agent 运行创建、停止和状态 |
| `/api/v1/runs/{id}/events` | 支持 `Last-Event-ID` 的 SSE |
| `/api/v1/approvals/{id}/decision` | 一次性允许或拒绝工具动作 |
| `/api/v1/model-comparisons` | 2–4 路模型并行运行 |
| `/api/v1/scheduled-tasks` | 定时任务配置 |
| `/api/v1/audit` | Owner/Admin 审计查询 |
| `/v1/*` | OpenAI 兼容模型、对话和图像转发网关；必须认证并提供 `X-LLMira-Workspace-Id` |

共享结构定义在 [`packages/contracts`](../packages/contracts/src/index.ts)。错误统一返回 `error.code`、面向用户的 `message` 和可选 `requestId`。

## 认证与密钥

- 密码：Argon2id；生产环境不接受弱 JWT 或主加密密钥。
- 浏览器：15 分钟访问 Cookie、30 天旋转刷新 Cookie，均为 HttpOnly。
- Tauri：Bearer 访问令牌；刷新令牌只在 Stronghold 中持久化。
- Provider：AES-256-GCM 信封保存，Worker 仅在调用边界解密。
- 路由顺序：个人 BYOK → 团队密钥 → 不可用。

响应、SSE、审计和日志都不得包含明文密钥。密钥更新审计只记录名称、范围、脱敏地址和结果。

## 工具风险与重试

| 风险 | 默认行为 | 重试 |
| --- | --- | --- |
| `read` | 自动执行 | 明确失败可退避重试 |
| `write` | 暂停等待逐次授权 | 模糊结果禁止自动重试 |
| `external_side_effect` | 暂停并展示目标与范围 | 禁止自动重试 |
| `irreversible` | 暂停并强化风险提示 | 禁止自动重试 |

定时任务遇到后三类风险同样停在 `waiting_approval`。授权不会成为会话级或永久许可。

## 输入安全

- 文件上限 250 MB，允许 PDF、DOCX、TXT、Markdown、HTML、CSV。
- 网页抓取只允许 HTTP(S)，拒绝凭据 URL、本机、内网、链路本地、云元数据与危险重定向。
- MCP 工具必须声明风险、超时、输出上限和允许域名；服务器 stdio 仅接受固定 digest 镜像，并通过只读、无网络、CPU/内存/PID 限额的容器执行。
- Windows 个人端的 stdio MCP 由 Tauri/Rust 运行时隔离执行，命令与参数分开传递；Android/Web 仅允许远程 Streamable HTTP MCP。

## 审计

审计记录发起者、授权人、动作、目标、脱敏参数、结果摘要与时间戳。跨工作区访问同时受显式角色检查和 PostgreSQL RLS 限制。
