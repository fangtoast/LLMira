# LLMira 文档索引

本目录存放模块说明、接口约定与维护记录，与代码同级演进。

## 总览

| 文档 | 说明 |
|------|------|
| [engineering/architecture.md](engineering/architecture.md) | 目录职责、数据流、与 Dexie/API 的关系 |
| [engineering/CONTRIBUTING.md](engineering/CONTRIBUTING.md) | 日志、文件头、注释等工程约定（贡献者向） |
| [engineering/python-appendix.md](engineering/python-appendix.md) | Python 文件头 / docstring / 与 TS 对齐 |

## 功能模块（features）

| 文档 | 说明 |
|------|------|
| [features/chat-streaming.md](features/chat-streaming.md) | SSE 流式对话与发送链路 |
| [features/persistence-dexie.md](features/persistence-dexie.md) | IndexedDB / Dexie 持久化 |
| [features/api-client.md](features/api-client.md) | HTTP 与 OpenAI 兼容 API |
| [features/settings-and-models.md](features/settings-and-models.md) | 设置持久化与模型列表 |
| [features/markdown-rendering.md](features/markdown-rendering.md) | Markdown、公式与代码块 |

## 配置第三方 API（Base URL 与 API Key）

应用通过 **OpenAI 兼容** 的 HTTP 接口（如 `GET /v1/models`、`POST /v1/chat/completions` 等）连接大模型服务。你可以使用**任意**提供该协议的供应商；下列以 **慧言** 为**示例**（本仓库默认回退的 Base URL 也基于该服务），**不是**唯一选项。若你使用其他厂商，只需把 **Base URL** 和 **Key** 换成对方控制台提供的值即可。

### 1. 替换服务地址（Base URL）

| 方式 | 说明 |
|------|------|
| **环境变量（推荐）** | 在**项目根目录**（与 `package.json` 同级）创建或编辑 `.env.local`，设置 `NEXT_PUBLIC_API_BASE_URL=你的服务根地址`。**不要**在路径末尾多写 `/v1`：代码里会再拼接 `/v1/...`。 |
| **参考模板** | 复制仓库中的 [`.env.example`](../.env.example) 为 `.env.local`，把示例里的地址改成你的第三方根 URL。 |
| **代码回退** | 若未设置该变量，客户端会回退到 `src/lib/api/client.ts` 内写死的默认地址（仅作开发/文档示例，生产环境请显式配置环境变量）。 |

**重要（Next.js）：** 以 `NEXT_PUBLIC_` 开头的变量会参与**前端打包**。修改后请**重启** `npm run dev`，生产环境需**重新执行** `npm run build` 后再部署，否则浏览器里仍是旧地址。

**【配图建议】** 在文档或 Wiki 中可附一张：编辑器中打开 `.env.local`、仅展示键名与假地址行（**不要**含真实 Key）的截图，便于新成员对照。

### 2. 配置 API Key

| 项 | 说明 |
|----|------|
| **在应用内填写** | 启动后若未配置 Key，会触发「配置 API Key」弹窗；也可在侧栏/设置中打开。输入后保存，Key 会写入**当前浏览器**的本地存储（与 [settingsStore](../src/lib/store/settingsStore.ts) 的持久化键一致，勿在公共环境使用工作用 Key）。 |
| **从哪拿 Key** | 在你所选的**第三方**控制台创建 API 令牌；格式视厂商而定（常见为 `sk-` 前缀），以对方文档为准。 |
| **与 Base URL 的关系** | Key 只表示「谁有权访问」；**发向哪台服务器**由 `NEXT_PUBLIC_API_BASE_URL` 决定。两者须来自**同一**服务/同一套接口，避免混用 A 家 Key + B 家地址。 |
| **安全** | 勿将含真实 Key 的界面截图、录屏或提交到公开仓库。 |

**【配图建议】** 附一张应用内「配置 API Key」弹窗的**示意图**（可用占位文案或已撤销的测试 Key 打码展示），标出「保存」后 Key 仅在本机浏览器生效。

### 3. 模型列表与可选预设

`GET /v1/models` 的返回结构因厂商而异，项目内已做多种 JSON 形态兼容。若列表过少或拉取失败，可在 `.env.local` 中设置 `NEXT_PUBLIC_MODEL_PRESET`（英文/中文逗号分隔的模型 id），与接口结果合并。详见 [settings-and-models.md](features/settings-and-models.md)。

### 4. 与本文档其他章节的关系

- 请求与流式行为细节见 [api-client.md](features/api-client.md) 与 [chat-streaming.md](features/chat-streaming.md)。
- 本地数据**不**含你的 API Key 的跨设备同步说明见 [persistence-dexie.md](features/persistence-dexie.md)（Key 在 localStorage，换浏览器需重新填）。对话内容在 **IndexedDB**，与 **协议 + 主机 + 端口** 同源绑定；换端口或 `localhost` / `127.0.0.1` 混用会看起来像「新环境」。可使用侧栏 **全量备份** 导出 JSON 冗余保存。

## 目录约定

| 路径 | 用途 |
|------|------|
| [`engineering/`](engineering/) | 架构与工程约定 |
| [`templates/feature-module.md`](templates/feature-module.md) | 新功能文档模版 |
| [`features/`](features/) | 各功能模块文档，文件名建议 `kebab-case.md` |

## 新建功能文档时

1. 复制 [`templates/feature-module.md`](templates/feature-module.md) 到 `docs/features/<名称>.md`。
2. 填充分功能描述、接口（组件 props / 导出函数签名）、注意事项。
3. 重大变更时在文末 **维护记录** 追加一行（日期 + 简述）。
