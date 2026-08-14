/**
 * @project LLMira
 * @file src/lib/providers/inspect.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 从当前运行时扫描 OpenAI-compatible 模型
 *   - 把 provider-core 错误保持为可展示分类
 * @description 本模块不持久化输入密钥，保存动作由 Provider 设置页面显式执行。
 */
import { inspectOpenAICompatibleProvider } from "@llmira/provider-core";
import { runtimeFetch } from "@/lib/providers/runtime";

/** 使用设备或浏览器 transport 真实访问 `/v1/models`。 */
export async function inspectProvider(input: { providerId: string; baseUrl: string; apiKey: string }) {
  return inspectOpenAICompatibleProvider({
    ...input,
    fetchImpl: runtimeFetch as typeof fetch,
    allowInsecureLocalhost: true,
  });
}
