/**
 * @project LLMira
 * @file packages/provider-core/vitest.config.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description Provider 协议核心的 Node 单元测试配置。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
