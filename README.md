<!--
  Purpose: LLMira 团队版仓库入口与可执行快速指南
  Author: fangtoast <fangtoast@foxmail.com>
  Copyright: LLMira contributors
-->

<div align="center">
  <h1>LLMira</h1>
  <strong>自托管团队 AI 工作台</strong>
  <p>团队知识库 · 多模型协作 · 安全 Agent 授权 · Web / Windows / Android</p>
  <p><a href="#readme-zh-cn">中文</a> · <a href="#english-version">English</a> · <a href="docs/README.md">文档</a> · <a href="docs/engineering/architecture.md">架构</a> · <a href="AGENTS.md">Next.js 规则</a></p>
</div>

---

<span id="readme-zh-cn"></span>

## 什么是 LLMira

LLMira 面向单组织 5–100 人团队，把对话、知识库、模型路由、MCP 和可审计 Agent 运行统一到一个工作台。首发采用团队服务器模式：浏览器与 Tauri 客户端不保存供应商密钥，也不在 WebView 中运行 Next.js 服务端。

当前工程包含：

- Next.js 16.3 静态客户端，桌面四栏工作台和 Android 四项底部导航；
- Fastify `/api/v1`、可续传 SSE 运行事件与带工作区认证的 OpenAI 兼容转发网关；
- PostgreSQL + pgvector、强制 RLS、Redis/BullMQ、MinIO，以及可选 OCR 容器边界；
- Argon2id、邀请制登录、个人 BYOK 优先、AES-256-GCM 密钥信封与审计；
- Tauri 2 Windows / Android 外壳、Stronghold 和 SQLite 离线草稿 outbox。

## 快速开始

| 环境 | 要求 |
| --- | --- |
| Node.js | 24.x |
| npm | 11.x |
| 团队服务 | PostgreSQL 17 + pgvector、Redis、MinIO |
| Windows 打包 | Rust、MSVC、WebView2、WiX/NSIS |
| Android 打包 | JDK 17、Android SDK/NDK、Rust Android target |

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Web 客户端默认连接 `http://localhost:4000`。也可以在连接页填写团队服务器地址；生产环境应使用 HTTPS。

### 启动团队服务

先在独立部署环境中设置高熵 `JWT_SECRET`、`ENCRYPTION_MASTER_KEY`、数据库与 MinIO 密码，然后运行：

```powershell
docker compose up -d
```

首次访问由管理员初始化组织；后续成员通过邀请加入。真实密钥只在“设置 → 模型供应商”进入服务器，不写入前端环境变量。

## 常用命令

| 场景 | 命令 |
| --- | --- |
| 前端开发 | `npm run dev` |
| API / Worker 开发 | `npm run dev --workspace @llmira/api` / `npm run dev --workspace @llmira/worker` |
| 完整质量门禁 | `npm run check` |
| 服务端单元测试 | `npm run test --workspace @llmira/api` |
| Worker 安全测试 | `npm run test --workspace @llmira/worker` |
| Rust 检查 | `cargo check --manifest-path src-tauri/Cargo.toml` |
| Windows 安装包 | `npm run tauri:build:windows` |
| Android 初始化 / 构建 | `npm run tauri:android:init` / `npm run tauri:build:android` |

## 关键行为

| 场景 | 行为 |
| --- | --- |
| 模型密钥 | 个人密钥 → 团队密钥 → 不可用；密钥不返回客户端 |
| Agent 工具 | 读取自动执行；写入、外部副作用、不可逆操作逐次暂停授权 |
| 知识来源 | PDF、DOCX、TXT、Markdown、HTML、CSV 与安全网页抓取 |
| 共享嵌入 | 使用团队嵌入配置；更换模型后必须重建索引 |
| 旧数据 | 幂等导入个人工作区；旧 API Key 不自动上传 |
| 离线 | 仅近期缓存、草稿与 outbox；知识检索和 Agent 仍需服务器 |

当前已打通的首发纵向链路包括：真实流式对话与停止、2–4 路模型对比、文件/网页摄取、向量与全文融合检索、可定位引用、逐次授权、定时任务调度、安全 MCP HTTP/隔离容器执行、团队用量、成员邀请、Provider 配置和旧 Dexie 迁移。OCR profile 已预留安全容器边界，但扫描件识别提交适配器仍需结合最终选定的 OCR 服务实现；Windows 本机 stdio MCP 桥接与 iOS 不在首发范围。

## 架构摘要

```text
LLMira/
├── src/                    # Next.js 静态客户端与团队工作台
├── apps/api/               # Fastify API、认证、权限、SSE、审计
├── apps/worker/            # 知识摄取、混合检索准备、Agent 队列
├── packages/contracts/     # 客户端/API/Worker 共享类型
├── packages/security/      # 服务端密钥加密与令牌摘要
├── infra/                  # Caddy 与 PostgreSQL 迁移
├── src-tauri/              # Windows/Android、Stronghold、SQLite outbox
└── .github/workflows/      # 质量、Windows、Android 流水线
```

详细的数据边界、角色与运行状态机见[架构说明](docs/engineering/architecture.md)。

## 文档与安全

- [文档索引](docs/README.md)
- [部署与恢复](docs/部署与恢复.md)
- [发布与打包](docs/发布与打包.md)
- [API 与安全边界](docs/API与安全边界.md)
- [贡献指南](docs/engineering/CONTRIBUTING.md)

不要提交 `.env.local`、真实 API Key、Cookie、Stronghold 文件、数据库备份或签名证书。业务日志不得包含完整提示词、令牌和密钥。

## 当前验证边界

本仓库已配置 lint、TypeScript、Vitest、Next 静态导出、JS 体积预算、Rust 检查、临时服务集成任务、Windows 和 Android 构建流水线。Windows 可生成未签名 MSI/NSIS；正式签名、Android 本机构建、容器集成验收、域名与应用商店发布仍取决于发布环境和发布方凭据。

---

<span id="english-version"></span>

## English

LLMira is a self-hosted team AI workbench for shared knowledge, multi-model workflows, auditable agents, and MCP tools. The first release uses a team server; clients keep only recent cache, offline drafts, and an idempotent outbox.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Use `npm run check` for the web quality gate, `cargo check --manifest-path src-tauri/Cargo.toml` for the Tauri shell, and Docker Compose for the team services. See the [documentation index](docs/README.md) and [architecture](docs/engineering/architecture.md) for deployment and security details.
