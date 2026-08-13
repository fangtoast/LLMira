/**
 * @project LLMira
 * @file apps/worker/vitest.config.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 后台摄取与网络安全单元测试配置。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
