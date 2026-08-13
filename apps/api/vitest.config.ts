/**
 * @project LLMira
 * @file apps/api/vitest.config.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description Fastify API 集成测试配置。
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
