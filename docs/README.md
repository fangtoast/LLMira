# LLMira 文档索引

本目录存放模块说明、接口约定与维护记录，与代码同级演进。

## 总览

| 文档 | 说明 |
|------|------|
| [engineering/architecture.md](engineering/architecture.md) | 目录职责、数据流、与 Dexie/API 的关系 |
| [engineering/CONTRIBUTING.md](engineering/CONTRIBUTING.md) | Git、日志、文件头、注释（给人读） |
| [engineering/python-appendix.md](engineering/python-appendix.md) | Python 文件头 / docstring / 与 TS 对齐 |

## 功能模块（features）

| 文档 | 说明 |
|------|------|
| [features/chat-streaming.md](features/chat-streaming.md) | SSE 流式对话与发送链路 |
| [features/persistence-dexie.md](features/persistence-dexie.md) | IndexedDB / Dexie 持久化 |
| [features/api-client.md](features/api-client.md) | HTTP 与 OpenAI 兼容 API |
| [features/settings-and-models.md](features/settings-and-models.md) | 设置持久化与模型列表 |
| [features/markdown-rendering.md](features/markdown-rendering.md) | Markdown、公式与代码块 |

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
