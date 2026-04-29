# LLMira

基于 Next.js 14 + TypeScript 的本地优先 AI 对话应用，默认对接慧言 OpenAI 兼容接口。

## 功能特性

### 对话与交互

- 左侧历史会话 + 右侧主对话区；**桌面端**可折叠侧栏，**移动端**侧栏为抽屉（顶部菜单打开/遮罩关闭）
- 深色 / 浅色主题切换
- API Key 配置弹窗（未配置时自动提示）
- **流式对话**（SSE），支持 **停止生成**（Abort）
- 切换会话时自动中止当前流，避免串会话
- **深度思考**：可选开启；思考内容与正式回答分区展示（可折叠、灰色区分）
- 消息级操作：复制、编辑用户消息并重新回答、删除、最后一条助手 **重新生成**（对话 / 文生图按场景走对应请求）
- 顶部 **文生图 / 对话** 模式切换；文生图走 `images/generations` 接口

### 输入与附件

- 支持 **拖入**、**选择文件**、在输入框内 **粘贴** 图片或文件
- 多模态：图片随对话以 `image_url` 提交；非图片在发送文案中附带文件名提示
- 可选环境变量 **输入长度上限**：`NEXT_PUBLIC_INPUT_MAX_CHARS`（默认 16000）
- Enter 发送 / Shift+Enter 换行；发送结束后输入框自动聚焦

### 内容与数据

- Markdown + LaTeX (KaTeX) + 代码高亮（纵向限高、长代码可折叠）+ 一键复制
- 文生图结果：网格展示，支持 **放大预览**、下载、复制链接、加载失败重试
- Dexie.js **本地会话持久化**；侧栏支持按 **标题与消息正文** 搜索
- 侧栏 **重命名** 会话，支持导出 **JSON / Markdown / 纯文本**，以及 **导入 JSON**
- 宽屏下 **Artifacts** 右侧面板（代码或 HTML 片段预览）
- 开发模式下 pino 日志：`[Request Model]`、`[Stream Start]`、`[Token Count]`

### 其他

- 模型列表通过 `GET /v1/models` 拉取；可用 `NEXT_PUBLIC_MODEL_PRESET` 补充固定模型 id
- 响应式布局：视口与安全区（含底部输入区）适配移动浏览器

## API 文档参考

- [慧言 API 教程](https://doc.zhypub.cn/docs/api/)
- [OpenAI 协议示例](https://s.apifox.cn/684f53a9-f231-43b0-a0dc-e3224d5ab341/api-179544799)

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env.local
```

`.env.local` 示例：

```env
NEXT_PUBLIC_API_BASE_URL=https://api.huiyan-ai.cn
# 可选：模型下拉偏少或拉取失败时，用英文/中文逗号列出常用 id，与接口结果合并
# NEXT_PUBLIC_MODEL_PRESET=gpt-5-chat,deepseek-chat
# 可选：输入框最大字符数（默认 16000）
# NEXT_PUBLIC_INPUT_MAX_CHARS=16000
```

3. 启动开发服务

```bash
npm run dev
```

访问 `http://localhost:3000`（会重定向到 `/chat`）。

4. 构建与检查

```bash
npm run build
npm run lint
```

## 日志链路

开发模式下会打印：

- `[Request Model]`
- `[Stream Start]`
- `[Token Count]`

## Docker 部署

```bash
docker build -t llmira .
docker run --rm -p 3000:3000 --env NEXT_PUBLIC_API_BASE_URL=https://api.huiyan-ai.cn llmira
```

## Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)，例如：

- `feat: ...`
- `fix: ...`
- `refactor: ...`
- `docs: ...`
