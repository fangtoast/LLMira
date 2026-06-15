





# LLMira

基于 Next.js 14 与 TypeScript 的本地优先 AI 对话应用，默认对接慧言 OpenAI 兼容接口。   
流式对话、多模态附件、文生图、会话持久化与导出一站式完成。

**[English](#english-version)**  ·  **文档索引**  ·  架构  ·  [慧言 API](https://doc.zhypub.cn/docs/api/)





---

## 什么是 LLMira

LLMira 将以下几部分组合在一起：

1. **对话界面**：左侧历史会话、右侧主对话区；桌面端可折叠侧栏，移动端抽屉式导航；深色 / 浅色主题。
2. **模型与参数**：通过当前 API 中转站的 `GET /v1/models` 拉取模型列表，支持多 Profile 切换、按模型保存生成参数，并可一键应用到全部模型。
3. **本地数据与工具**：Dexie.js 会话持久化、搜索 / 重命名 / 导出（JSON、Markdown、纯文本）与导入；统一结构化日志 `@/lib/logger`。

面向大模型服务的「镜像式」接入：`LLM` + `Mira`（映照与交互界面）。详见下文「命名说明」。

## 快速上手

**环境准备：** 安装 [Node.js](https://nodejs.org/)（建议 **18.17+** 或 **20 LTS**，与 Next.js 14 要求一致；安装包自带 **npm**）。终端执行 `node -v`、`npm -v` 确认可用。若通过 Git 获取代码，还需安装 [Git](https://git-scm.com/)。本地开发用现代浏览器（Chrome、Edge、Firefox、Safari 等）即可。

以下命令均在**本仓库根目录**（`LLMira/`）执行。

```bash
npm install
cp .env.example .env.local
# 按需编辑 .env.local （该用其他api时需要修改该文件）
npm run dev
```

浏览器打开 `[http://localhost:3000](http://localhost:3000)`（会重定向到 `/chat`）。首次进入可按引导配置昵称、API Key 与模型参数。

**不用慧言 API、改用自己或第三方的 OpenAI 兼容服务时：** 可以在应用侧栏「设置 → API 中转站」新增多个 Profile，并分别填写名称、Base URL、API Key 与可选模型预设；点击切换后模型列表、对话与文生图都会使用当前 Profile。也可以在 `.env.local` 把 `NEXT_PUBLIC_API_BASE_URL` 作为默认根地址（路径里**不要**再拼 `/v1`，代码会自动接 `/v1/...`）。

```bash
# 可选：生产构建与检查
npm run build
npm run lint
```

常用环境变量示例见下方「本地开发」表格；完整说明仍可参考 [.env.example](.env.example)。

## 你想……


| 你想……        | 可以这样做                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 从零跑起来       | 按上文「快速上手」执行 `npm install` → `.env.local` → `npm run dev`                                                                             |
| 浏览模块文档      | [docs/README.md](docs/README.md)                                                                                                     |
| 了解目录与边界     | [docs/engineering/architecture.md](docs/engineering/architecture.md)                                                                 |
| 参与开发与提交规范   | [docs/engineering/CONTRIBUTING.md](docs/engineering/CONTRIBUTING.md)                                                                 |
| 查 API 协议与示例 | [慧言 API 教程](https://doc.zhypub.cn/docs/api/) · [OpenAI 协议示例](https://s.apifox.cn/684f53a9-f231-43b0-a0dc-e3224d5ab341/api-179544799) |


Next.js 应用细节与约束见 [AGENTS.md](AGENTS.md)。

## 架构

```text
LLMira/
├── src/
│   ├── app/           # App Router：页面与 error 边界
│   ├── components/    # UI：chat、layout、markdown、modals、ui（Radix）
│   ├── hooks/        # useChat、useConversations、useModels 等
│   ├── lib/          # api、db、store、logger、chat 工具
│   └── types/        # 共享 TS 类型
├── docs/
│   ├── engineering/   # 架构、贡献指南、Python 附录等
│   └── features/     # 按模块的功能说明
├── public/           # 静态资源（含 llmira-logo.svg）
└── images/           # README 等行为截图
```

**技术栈**：Next.js 14、React 18、TypeScript、Tailwind CSS、Zustand、Dexie、pino。

## 本地开发


| 目的      | 命令                            | 说明              |
| ------- | ----------------------------- | --------------- |
| 日常界面与联调 | `npm run dev`                 | 读取 `.env.local` |
| 生产构建验证  | `npm run build` / `npm start` | 部署前自检           |
| 代码风格    | `npm run lint`                | ESLint          |


环境变量可参考 `.env.example`，例如：`NEXT_PUBLIC_API_BASE_URL`、`NEXT_PUBLIC_MODEL_PRESET`、`NEXT_PUBLIC_INPUT_MAX_CHARS`、`NEXT_PUBLIC_LOG_LEVEL` / `LOG_LEVEL` 等。

## 功能特性

### 对话与交互

- 流式输出（SSE）、停止生成（Abort）；切换会话时中止当前流
- 可选「深度思考」分区展示（可折叠）
- 消息级：复制、编辑用户消息并重答、删除、最后一条助手重新生成
- 顶部 **文生图 / 对话** 模式切换
- 应用内 API 中转站 Profile 切换，适配多个 OpenAI 兼容服务

### 输入与附件

- 拖入、选择文件、粘贴图片或文件；多模态与本地 PDF/文本解析
- 解析完成前保护发送；可选 `NEXT_PUBLIC_INPUT_MAX_CHARS`
- Enter 发送 / Shift+Enter 换行

### 内容与数据

- Markdown + LaTeX (KaTeX) + 代码高亮与复制
- 文生图网格、预览、下载、重试；文生图模式会按当前选择的图片模型发起请求
- Markdown 外链悬停预览，点击以安全新标签打开
- 侧栏搜索、重命名、导出 / 导入
- 宽屏提问导览与 Artifacts 面板

### 其他

- 模型列表与预设合并；响应式与安全区适配
- 业务日志关键字示例：`[Request Model]`、`[Stream Start]`、`[Token Count]`

## API 文档参考

- [慧言 API 教程](https://doc.zhypub.cn/docs/api/)
- [OpenAI 协议示例](https://s.apifox.cn/684f53a9-f231-43b0-a0dc-e3224d5ab341/api-179544799)

## 日志

请使用 `@/lib/logger`（`debug` / `info` / `warn` / `error`），勿在业务代码中裸用 `console.`*。级别由 `NEXT_PUBLIC_LOG_LEVEL` 或 `LOG_LEVEL` 控制（默认 `info`）。

## Docker 部署

```bash
docker build -t llmira .
docker run --rm -p 3000:3000 --env NEXT_PUBLIC_API_BASE_URL=https://api.huiyan-ai.cn llmira
```

## 命名说明

`LLMira` 可理解为 `LLM + Mira`：**LLM** 表示围绕大模型构建；**Mira** 取「镜像 / 映照（mirror）」与命名传统中的积极意象。在本项目中指面向大模型服务的镜像式接入与交互界面。

## 文档与规范

- [CHANGELOG.md](CHANGELOG.md)
- [docs/README.md](docs/README.md)
- [docs/engineering/CONTRIBUTING.md](docs/engineering/CONTRIBUTING.md)
- [docs/engineering/python-appendix.md](docs/engineering/python-appendix.md)
- [.cursor/rules/engineering-standards.mdc](.cursor/rules/engineering-standards.mdc)

## 页面展示

### 页面整体（暗色主题）

页面整体（暗色）

### 页面整体（亮色主题）

页面整体（亮色）

### 切换文生图模式

切换文生图模式

### 设置模型参数

设置模型参数

### 切换模型

切换模型

---







# LLMira

A local-first AI chat app built with Next.js 14 and TypeScript, targeting an OpenAI-compatible API (Huiyan by default).   
Streaming chat, multimodal attachments, image generation, persistence, and exports in one place.

**[中文版](#readme-zh-cn)**  ·  **Docs index**  ·  Architecture  ·  [Huiyan API](https://doc.zhypub.cn/docs/api/)





---

## What is LLMira

LLMira brings together:

1. **Chat UX**: Conversation history sidebar + main pane; collapsible sidebar on desktop and a drawer on mobile; light/dark themes.
2. **Models & parameters**: Models from the active API relay profile’s `GET /v1/models`, multiple switchable profiles, per-model generation settings, and optional apply-to-all-models.
3. **Local persistence & tooling**: Dexie-backed sessions, search/rename/import/export (JSON, Markdown, plain text), and structured logging via `@/lib/logger`.

The name suggests **LLM** plus **Mira** (mirror / reflection): an interface that reflects your chosen model API.

## Quick start

**Prerequisites:** Install [Node.js](https://nodejs.org/) (**18.17+** or **20 LTS** recommended; matches Next.js 14; includes **npm**). Run `node -v` and `npm -v` to verify. Install [Git](https://git-scm.com/) if you clone the repo. Use a modern browser for local dev.

Run these from the **repository root** (`LLMira/`).

```bash
npm install
cp .env.example .env.local
# Edit .env.local as needed
npm run dev
```

Open `[http://localhost:3000](http://localhost:3000)` (redirects to `/chat`). First launch walks you through nickname, API key, and model settings.

**Using a non-Huiyan OpenAI-compatible provider:** add profiles in the app sidebar under “Settings → API relay”, with a name, Base URL, API key, and optional model preset for each provider. Switching profiles immediately changes model listing, chat, and image generation. You can still set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` as the default root base URL (**do not** append `/v1`; paths like `/v1/...` are added in code).

```bash
# Optional: production build & checks
npm run build
npm run lint
```

For environment variables, see `.env.example` and the **Develop locally** table below.

## If you want to…


| You want to…                   | Do this                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run from scratch               | `npm install` → `.env.local` → `npm run dev`                                                                                                        |
| Browse module docs             | [docs/README.md](docs/README.md)                                                                                                                    |
| Understand layout & boundaries | [docs/engineering/architecture.md](docs/engineering/architecture.md)                                                                                |
| Contribute (Git/logging/style) | [docs/engineering/CONTRIBUTING.md](docs/engineering/CONTRIBUTING.md)                                                                                |
| Read API shapes & examples     | [Huiyan API docs](https://doc.zhypub.cn/docs/api/) · [OpenAI-style example](https://s.apifox.cn/684f53a9-f231-43b0-a0dc-e3224d5ab341/api-179544799) |


App-router conventions and constraints: see [AGENTS.md](AGENTS.md).

## Architecture

```text
LLMira/
├── src/
│   ├── app/           # App Router: routes & error boundaries
│   ├── components/    # UI: chat, layout, markdown, modals, ui (Radix)
│   ├── hooks/         # useChat, useConversations, useModels, …
│   ├── lib/           # api, db, store, logger, chat helpers
│   └── types/         # Shared TS types
├── docs/
│   ├── engineering/   # Architecture, contributing, Python appendix, …
│   └── features/      # Feature-focused notes
├── public/            # Static assets (incl. llmira-logo.svg)
└── images/            # Screenshots for docs / README
```

**Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, Dexie, pino.

## Develop locally


| Goal                  | Command                       | Notes             |
| --------------------- | ----------------------------- | ----------------- |
| Day-to-day dev        | `npm run dev`                 | Uses `.env.local` |
| Production-like check | `npm run build` / `npm start` | Before deploy     |
| Lint                  | `npm run lint`                | ESLint            |


Configure via `.env.example`: e.g. `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_MODEL_PRESET`, `NEXT_PUBLIC_INPUT_MAX_CHARS`, `NEXT_PUBLIC_LOG_LEVEL` / `LOG_LEVEL`.

## Features

### Chat & interaction

- Streaming (SSE), stop generation (Abort); abort on conversation switch
- Optional “deep thinking” separated from the final answer (collapsible)
- Per-message actions: copy, edit user message and re-run, delete, regenerate last assistant turn
- **Chat vs image generation** mode toggle at the top
- In-app API relay profiles for multiple OpenAI-compatible services

### Input & attachments

- Drag-and-drop, file picker, paste images/files; multimodal payloads
- PDF/text parsed locally before send; guarded send until parsing completes
- Optional `NEXT_PUBLIC_INPUT_MAX_CHARS`
- Enter to send, Shift+Enter for newline

### Content & data

- Markdown + LaTeX (KaTeX) + syntax-highlighted code with copy
- Image grid with preview, download, retry; image mode sends requests with the currently selected image model
- Markdown external-link hover previews, with safe new-tab opening on click
- Sidebar search/rename/import/export
- Wide-screen outline navigation and Artifacts panel

### Other

- Models list merged with presets; responsive layout / safe-area aware
- Log breadcrumbs such as `[Request Model]`, `[Stream Start]`, `[Token Count]`

## API reference links

- [Huiyan API tutorial](https://doc.zhypub.cn/docs/api/)
- [OpenAI-compatible example](https://s.apifox.cn/684f53a9-f231-43b0-a0dc-e3224d5ab341/api-179544799)

## Logging

Use `@/lib/logger` (`debug` / `info` / `warn` / `error`). Avoid raw `console.`* in application code. Level via `NEXT_PUBLIC_LOG_LEVEL` or `LOG_LEVEL` (default `info`).

## Docker

```bash
docker build -t llmira .
docker run --rm -p 3000:3000 --env NEXT_PUBLIC_API_BASE_URL=https://api.huiyan-ai.cn llmira
```

## Docs & standards

- [CHANGELOG.md](CHANGELOG.md)
- [docs/README.md](docs/README.md)
- [docs/engineering/CONTRIBUTING.md](docs/engineering/CONTRIBUTING.md)
- [docs/engineering/python-appendix.md](docs/engineering/python-appendix.md)
- [.cursor/rules/engineering-standards.mdc](.cursor/rules/engineering-standards.mdc)

## Screenshots

### Dark theme

Dark theme

### Light theme

Light theme

### Switch to image mode

Image mode

### Model parameters

Model parameters

### Switch model

Switch model
