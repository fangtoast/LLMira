/**
 * @project LLMira
 * @file vitest.config.mts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 浏览器客户端单元与组件测试配置。
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
