# 贡献与工程规范（LLMira）

本文与仓库根目录 [`.cursor/rules/engineering-standards.mdc`](../../.cursor/rules/engineering-standards.mdc) 同源，便于人类阅读与 onboarding。

- 架构总览：[architecture.md](architecture.md)
- Python 附录：[python-appendix.md](python-appendix.md)

## Git 提交

- 使用 [Conventional Commits](https://www.conventionalcommits.org/)：`feat`、`fix`、`docs`、`refactor`、`chore`、`test` 等。
- 尽量小而聚焦的提交，便于 review 与回滚。

## 日志

- 业务代码统一使用 `@/lib/logger`，勿直接使用 `console.*`（logger 实现文件除外）。
- 级别：`debug` < `info` < `warn` < `error`。环境变量 `NEXT_PUBLIC_LOG_LEVEL` 或 `LOG_LEVEL` 可取 `debug`、`info`、`warn`、`error`（默认 `info`）。
- 捕获的异常应记录上下文；推荐使用 `logger.exception()` 保留堆栈语义。

## 文件头与注释

- 新建或大幅修改的 `.ts` / `.tsx` 文件建议使用 JSDoc 文件头，包含 `@project`、`@file`、`@author fangtoast <fangtoast@foxmail.com>`、`@description`。
- 导出函数与组件需有 JSDoc；复杂逻辑注明 **Why**。

## 文档

- 功能交付后可在 `docs/features/` 下新增模块文档，模版见 [`docs/templates/feature-module.md`](../templates/feature-module.md)。
- 重大功能请同步更新根目录 [`README.md`](../../README.md) 中的功能清单。

## 代码生成模版（摘录）

### TS 模块文件头

```ts
/**
 * @project LLMira
 * @file src/lib/example.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 简要职责
 * @description 模块角色与依赖。
 */
```

### React 组件（节选）

```tsx
interface FooProps {
  /** 展示文案 */
  title: string;
}

/**
 * 单行说明组件用途。
 */
export function Foo({ title }: FooProps) {
  return null;
}
```

### 自定义 Hook（节选）

```ts
/**
 * 说明副作用（订阅、清理）与返回值含义。
 */
export function useFoo() {}
```
