# Huiyan-AI Pro

专业级 AI 镜像站，基于 Next.js 14 + TypeScript。

## 功能特性

- 左侧历史会话 + 右侧主对话区（可折叠侧边栏）
- 深色/浅色主题切换
- API Key 配置弹窗（未配置时自动提示）
- OpenAI 协议流式对话（`https://api.huiyan-ai.cn`）
- Markdown + LaTeX (KaTeX) + 代码高亮 + 一键复制
- Dexie.js 本地会话持久化与搜索
- 模型动态拉取（`GET /v1/models`）与切换
- Token 使用量与估算成本展示
- Artifacts 右侧预览面板
- pino 请求日志与异常日志

## API 文档参考

- [慧言 API 教程](https://doc.zhypub.cn/docs/api/)
- [OpenAI 协议示例](https://s.apifox.cn/684f53a9-f231-43b0-a0dc-e3224d5ab341/api-179544799)

## 本地开发

1) 安装依赖

```bash
npm install
```

2) 配置环境变量

```bash
cp .env.example .env.local
```

`.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.huiyan-ai.cn
```

3) 启动开发服务

```bash
npm run dev
```

访问 `http://localhost:3000`，会自动重定向到 `/chat`。

## 日志链路

开发模式下会打印：

- `[Request Model]`
- `[Stream Start]`
- `[Token Count]`

## Docker 部署

```bash
docker build -t huiyan-ai-pro .
docker run --rm -p 3000:3000 --env NEXT_PUBLIC_API_BASE_URL=https://api.huiyan-ai.cn huiyan-ai-pro
```

## Git 提交规范

使用 Conventional Commits：

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
