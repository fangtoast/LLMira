# Markdown 与代码渲染

## 功能描述

助手消息通过 `MarkdownRenderer` 渲染为 HTML，集成 KaTeX（数学公式）、代码块（Prism / Shiki 等，以仓库实现为准）、图片与链接安全策略；长代码块支持限高与折叠。

## 接口定义

| 组件 | 路径 | 说明 |
|------|------|------|
| `MarkdownRenderer` | `src/components/markdown/MarkdownRenderer.tsx` | 入口 props：`content: string` 等 |
| `CodeBlock` | `src/components/markdown/CodeBlock.tsx` | 单块高亮与复制 |

## 参数说明

- **数学**：通过 `remark-math` + `rehype-katex`（见依赖与组件配置）。
- **主题**：随全局明暗主题切换样式（具体 className 见组件）。

## 调用示例

在 `MessageBubble` 内对 `assistant` 的 `content` 传入 `MarkdownRenderer`。

## 注意事项

- 嵌套 HTML / 脚本类内容需依赖 Markdown 引擎默认净化策略；若扩展 raw HTML，需评估 XSS。
- LaTeX 复杂公式可能影响布局，已通过容器样式约束。

## 维护记录

| 日期 | 说明 |
|------|------|
| 2026-04-30 | 初稿 |
