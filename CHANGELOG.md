# Changelog

本项目的重要变更记录在本文档（面向人类读者；可按版本 semver 继续细分）。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，提交习惯见 [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Added

- 附件解析中的 `reading` 状态：输入区展示「读取中」，解析完成前禁止发送。
- 按模型的生成参数持久化（`temperature`、`top_p`、`max_tokens`、`presence` / `frequency` penalty）；侧边栏支持「将当前参数应用到全部模型」。
- 构造 API `messages` 时对附件正文做分块注入（带分块序号），并设总字符预算以降低超上下文风险。
- PDF 解析阶段保留全文并记录字符数元数据。

### Changed

- `pdf.js` Worker 在生产构建中使用与 `pdfjs-dist` 版本对齐的 CDN 地址，避免打包 worker 脚本的兼容性错误。
- `useChat` 请求参数改为读取当前对话模型对应的参数档案。

### Fixed

- PDF 读取：正确配置 Worker，避免前端解析报错。
