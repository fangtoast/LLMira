/**
 * @project LLMira
 * @file apps/api/src/server.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 启动 LLMira 团队 API
 *   - 处理系统退出信号并优雅关闭连接
 * @description 进程入口不包含业务逻辑，便于测试直接复用 buildApp。
 */
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await buildApp({ config });

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await app.listen({ host: config.host, port: config.port });
